import Hls from 'hls.js';
import type { ErrorData } from 'hls.js';

export interface PlayerFailure {
  /** One line saying what went wrong. */
  message: string;
  /** What to actually do about it — empty when there is nothing useful to say. */
  hint: string;
  /**
   * Whether waiting could fix this by itself. A dead connection recovers; a
   * manifest served without CORS headers never will, and telling someone to
   * "riprova" in that case only wastes their evening.
   */
  transient: boolean;
}

/**
 * Turns an hls.js fatal error into something worth reading.
 *
 * The generic "impossibile riprodurre il contenuto" is exactly wrong for this
 * app: CineMate plays sources *you* configured, so the failure is almost always
 * a fixable mistake in that configuration — a typo in the address, a server
 * that answers without CORS headers, a file that isn't where the pattern said.
 * Each of those has a different fix, and the player is the only place that
 * knows which one happened.
 */
export function describeFailure(data: ErrorData): PlayerFailure {
  const status = (data.response as { code?: number } | undefined)?.code ?? 0;
  const url = data.url ?? '';

  if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
    if (status === 404 || status === 410) {
      return {
        message: 'Il server risponde, ma il file non c’è (404).',
        hint: 'L’indirizzo arriva fin lì ma il nome del file non corrisponde. Controlla il modello in Impostazioni, o incolla l’indirizzo esatto nel pannello Sorgenti.',
        transient: false,
      };
    }
    if (status === 401 || status === 403) {
      return {
        message: 'Il server rifiuta la richiesta (accesso negato).',
        hint: 'Serve un’autenticazione che il player non può fare da solo. Usa un indirizzo già autorizzato, oppure scarica il titolo e riproducilo offline.',
        transient: false,
      };
    }
    if (status >= 500) {
      return {
        message: `Il server ha un problema suo (${status}).`,
        hint: 'Non dipende da te. Se hai più host configurati il player proverà gli altri; altrimenti riprova fra poco.',
        transient: true,
      };
    }
    if (!navigator.onLine) {
      return {
        message: 'Sei offline.',
        hint: 'Riparte da solo appena torna la connessione. I titoli scaricati si guardano anche adesso, dal pannello Download.',
        transient: true,
      };
    }
    // Status 0 with no response is the signature of a request that never
    // completed: DNS, TLS, or — by far the most common here — a server that
    // simply doesn't send Access-Control-Allow-Origin.
    if (status === 0) {
      return {
        message: 'Il server non risponde, o rifiuta le richieste da questa pagina.',
        hint: 'Di solito è CORS: il server deve inviare Access-Control-Allow-Origin. Verifica anche che l’indirizzo sia raggiungibile e in https, e prova gli altri host dal pannello Host.',
        transient: true,
      };
    }
    return {
      message: 'Errore di rete durante il caricamento.',
      hint: url ? `Ultima richiesta fallita: ${short(url)}` : '',
      transient: true,
    };
  }

  // A playlist that isn't a playlist, or one whose codecs this browser cannot
  // open, is settled the moment it is read. These arrive as OTHER_ERROR rather
  // than as network failures, so without this branch they fell through to the
  // generic "transient" case and were retried five times over thirty seconds
  // before saying anything — the exact black rectangle this file exists to
  // prevent.
  if (data.details === Hls.ErrorDetails.MANIFEST_PARSING_ERROR) {
    return {
      message: 'L’indirizzo risponde, ma non con una playlist HLS.',
      hint: 'Quello che arriva non è un file .m3u8 valido — spesso è una pagina di errore, o un login, servito con il nome giusto. Apri l’indirizzo nel browser per vedere cosa risponde davvero.',
      transient: false,
    };
  }
  if (data.details === Hls.ErrorDetails.MANIFEST_INCOMPATIBLE_CODECS_ERROR) {
    return {
      message: 'La playlist dichiara codec che questo browser non apre.',
      hint: 'Di solito è HEVC/H.265 o AC-3. Prova un altro browser, oppure ricodifica la sorgente in H.264 + AAC.',
      transient: false,
    };
  }
  if (data.details === Hls.ErrorDetails.LEVEL_EMPTY_ERROR) {
    return {
      message: 'La playlist non contiene nessun segmento.',
      hint: 'Il manifest è valido ma vuoto: se lo stai generando tu, probabilmente è stato letto mentre veniva scritto.',
      transient: true,
    };
  }

  if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
    if (data.details === Hls.ErrorDetails.BUFFER_INCOMPATIBLE_CODECS_ERROR) {
      return {
        message: 'Questo browser non sa decodificare la traccia.',
        hint: 'Il flusso usa un codec non supportato qui — spesso HEVC/H.265 o AC-3. Prova con un altro browser, o ricodifica la sorgente in H.264 + AAC.',
        transient: false,
      };
    }
    return {
      message: 'Flusso danneggiato durante la decodifica.',
      hint: 'Il player prova a ricucirlo da solo. Se continua, il file o un suo segmento è corrotto.',
      transient: true,
    };
  }

  if (data.type === Hls.ErrorTypes.MUX_ERROR) {
    return {
      message: 'I segmenti non sono nel formato atteso.',
      hint: 'La playlist punta a file che non sono quelli che dichiara. Rigenera il manifest, oppure indica direttamente il file video nel pannello Sorgenti.',
      transient: false,
    };
  }

  return {
    message: 'Riproduzione interrotta da un errore.',
    hint: data.details ? `Dettaglio tecnico: ${data.details}` : '',
    transient: true,
  };
}

/** Keeps a URL readable in a message box instead of wrapping over four lines. */
function short(url: string): string {
  try {
    const u = new URL(url);
    const tail = u.pathname.split('/').filter(Boolean).pop() ?? '';
    return `${u.host}/…/${tail}`;
  } catch {
    return url.length > 60 ? `${url.slice(0, 57)}…` : url;
  }
}
