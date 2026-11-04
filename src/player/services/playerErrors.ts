import Hls from 'hls.js';
import type { ErrorData } from 'hls.js';
import { t } from "../../lib/i18n";

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
        message: t("player_playerErrors.il_server_risponde_ma"),
        hint: t("player_playerErrors.l_indirizzo_arriva_fin"),
        transient: false,
      };
    }
    if (status === 401 || status === 403) {
      return {
        message: t("player_playerErrors.il_server_rifiuta_la"),
        hint: t("player_playerErrors.serve_un_autenticazione_che"),
        transient: false,
      };
    }
    if (status >= 500) {
      return {
        message: t("player_playerErrors.il_server_ha_un", { v0: status }),
        hint: t("player_playerErrors.non_dipende_da_te"),
        transient: true,
      };
    }
    if (!navigator.onLine) {
      return {
        message: t("player_playerErrors.sei_offline"),
        hint: t("player_playerErrors.riparte_da_solo_appena"),
        transient: true,
      };
    }
    // Status 0 with no response is the signature of a request that never
    // completed: DNS, TLS, or — by far the most common here — a server that
    // simply doesn't send Access-Control-Allow-Origin.
    if (status === 0) {
      return {
        message: t("player_playerErrors.il_server_non_risponde"),
        hint: t("player_playerErrors.di_solito_e_cors"),
        transient: true,
      };
    }
    return {
      message: t("player_playerErrors.errore_di_rete_durante"),
      hint: url ? t("player_playerErrors.ultima_richiesta_fallita", { v0: short(url) }) : '',
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
      message: t("player_playerErrors.l_indirizzo_risponde_ma"),
      hint: t("player_playerErrors.quello_che_arriva_non"),
      transient: false,
    };
  }
  if (data.details === Hls.ErrorDetails.MANIFEST_INCOMPATIBLE_CODECS_ERROR) {
    return {
      message: t("player_playerErrors.la_playlist_dichiara_codec"),
      hint: t("player_playerErrors.di_solito_e_hevc"),
      transient: false,
    };
  }
  if (data.details === Hls.ErrorDetails.LEVEL_EMPTY_ERROR) {
    return {
      message: t("player_playerErrors.la_playlist_non_contiene"),
      hint: t("player_playerErrors.il_manifest_e_valido"),
      transient: true,
    };
  }

  if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
    if (data.details === Hls.ErrorDetails.BUFFER_INCOMPATIBLE_CODECS_ERROR) {
      return {
        message: t("player_playerErrors.questo_browser_non_sa"),
        hint: t("player_playerErrors.il_flusso_usa_un"),
        transient: false,
      };
    }
    return {
      message: t("player_playerErrors.flusso_danneggiato_durante_la"),
      hint: t("player_playerErrors.il_player_prova_a"),
      transient: true,
    };
  }

  if (data.type === Hls.ErrorTypes.MUX_ERROR) {
    return {
      message: t("player_playerErrors.i_segmenti_non_sono"),
      hint: t("player_playerErrors.la_playlist_punta_a"),
      transient: false,
    };
  }

  return {
    message: t("player_playerErrors.riproduzione_interrotta_da_un"),
    hint: data.details ? t("player_playerErrors.dettaglio_tecnico", { v0: data.details }) : '',
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
