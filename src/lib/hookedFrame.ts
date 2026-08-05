import { BLOCKED_HOSTS } from "./netBlocklist";

/**
 * **Lettura hookata**: la pagina di un sito eseguita dentro un riquadro nostro,
 * con uno script iniettato prima del suo, che guarda cosa chiede alla rete.
 *
 * È l'equivalente in un browser della tecnica che un'app nativa usa con
 * `evaluateJavascript` più `shouldInterceptRequest`, e nasce da una domanda che
 * sembrava avere una risposta sola: *in un iframe di un altro dominio non si
 * può iniettare niente.* Vero — ma l'iframe non deve per forza essere di un
 * altro dominio. Se la pagina la leggiamo noi e la mettiamo nel riquadro con
 * `srcdoc`, il documento è **nostro**, e in un documento nostro lo script ci
 * si mette.
 *
 * ## Perché non regala le chiavi di casa
 *
 * Un documento `srcdoc` eredita l'origine di chi lo contiene, e questo — se
 * fosse tutto — significherebbe far girare il JavaScript di un sito qualunque
 * nella **nostra** origine, con accesso al `localStorage` dove stanno la chiave
 * TMDB, quella Anthropic e l'intera libreria. Sarebbe il modo più diretto di
 * regalarle.
 *
 * La sandbox lo impedisce, e il come conta: il riquadro riceve
 * `sandbox="allow-scripts"` **senza** `allow-same-origin`. È l'unica
 * combinazione giusta delle tre possibili — gli script girano, ma il documento
 * ottiene un'*origine opaca*, cioè un'origine che non coincide con nessun'altra,
 * nemmeno con la nostra. Da lì dentro non si legge il nostro `localStorage`,
 * non si tocca il nostro DOM, non si leggono i nostri cookie. L'unico canale
 * verso l'esterno è `postMessage`, che è esattamente il ponte che serve.
 *
 * ## Cosa fa lo script iniettato
 *
 * Le stesse quattro cose dell'app nativa, con le API di qui:
 *
 * | Nativo | Qui |
 * |---|---|
 * | hook di `window.fetch` e `XMLHttpRequest.prototype.open` | identico: sono le stesse API |
 * | `WebChromeClient.onCreateWindow` che nega la finestra | `window.open` riscritto perché torni `null` |
 * | `shouldOverrideUrlLoading` che confronta il dominio | click e submit intercettati, e il salto fuori dominio annullato |
 * | `MutationObserver` che toglie i banner sovrapposti | identico |
 *
 * ## Il limite, che resta
 *
 * Per mettere la pagina nel riquadro bisogna prima **leggerla**, e leggerla
 * richiede i suoi header CORS. Dove non ci sono, questa modalità non parte e
 * resta la visualizzazione normale, che la pagina la mostra senza leggerla. Non
 * è un ripiego: sono due modalità con due punti di forza opposti, e
 * l'interfaccia dice quale sta usando.
 */

/** Il dominio di partenza, per il guard di navigazione. */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

/**
 * I messaggi che lo script iniettato manda a chi lo contiene.
 * `kind` è discriminante: il ricevente non deve indovinare cosa è arrivato.
 */
export type FrameMessage =
  | { kind: "media"; url: string; via: "fetch" | "xhr" }
  | { kind: "blocked"; url: string }
  | { kind: "popup"; url: string }
  | { kind: "navigation"; url: string; allowed: boolean }
  | { kind: "cleaned"; count: number }
  | { kind: "ready" };

/** Riconosce un messaggio del riquadro, che arriva da un'origine opaca. */
export function isFrameMessage(value: unknown): value is FrameMessage {
  if (!value || typeof value !== "object") return false;
  const kind = (value as { kind?: unknown }).kind;
  return (
    kind === "media" ||
    kind === "blocked" ||
    kind === "popup" ||
    kind === "navigation" ||
    kind === "cleaned" ||
    kind === "ready"
  );
}

/**
 * Lo script iniettato, come sorgente.
 *
 * Scritto a mano come stringa invece che compilato: deve girare *prima* di
 * qualsiasi script della pagina — è tutto il punto, un hook messo dopo non vede
 * la richiesta già partita — quindi finisce in un `<script>` in testa al
 * documento, senza `type="module"` e senza niente da caricare. Tutto quello che
 * usa esiste in ogni browser da anni: niente sintassi che un motore di un
 * televisore possa non digerire.
 */
function injectedSource(originHost: string, blockedHosts: string[]): string {
  return `
(function () {
  var HOST = ${JSON.stringify(originHost)};
  var BLOCKED = ${JSON.stringify(blockedHosts)};
  var MEDIA = /\\.(m3u8?|mpd|ts|m4s|mp4|vtt|key)(\\?|#|$)/i;

  function send(msg) {
    try { parent.postMessage(msg, '*'); } catch (e) {}
  }

  function hostOf(u) {
    try { return new URL(u, location.href).hostname.replace(/^www\\./, '').toLowerCase(); }
    catch (e) { return ''; }
  }

  function isBlocked(u) {
    var h = hostOf(u);
    if (!h) return false;
    for (var i = 0; i < BLOCKED.length; i++) {
      if (h === BLOCKED[i] || h.slice(-(BLOCKED[i].length + 1)) === '.' + BLOCKED[i]) return true;
    }
    return false;
  }

  function absolute(u) {
    try { return new URL(u, location.href).toString(); } catch (e) { return String(u); }
  }

  function note(u, via) {
    var abs = absolute(u);
    if (isBlocked(abs)) { send({ kind: 'blocked', url: abs }); return true; }
    if (MEDIA.test(abs)) send({ kind: 'media', url: abs, via: via });
    return false;
  }

  // --- 1. Hook di fetch e XHR: la ragione per cui questa modalità esiste ----
  var nativeFetch = window.fetch;
  if (nativeFetch) {
    window.fetch = function (input, init) {
      var u = typeof input === 'string' ? input : (input && input.url) || String(input);
      if (note(u, 'fetch')) return Promise.reject(new TypeError('bloccato'));
      return nativeFetch.apply(window, arguments);
    };
  }

  var nativeOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    if (note(url, 'xhr')) {
      return nativeOpen.call(this, method, 'about:blank');
    }
    return nativeOpen.apply(this, arguments);
  };

  // Anche i <source> e i <video src> messi nel DOM: certi player non passano
  // da fetch, assegnano direttamente l'attributo e lasciano fare al browser.
  var nativeSetAttribute = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (name, value) {
    if ((name === 'src' || name === 'data-src') && typeof value === 'string') note(value, 'fetch');
    return nativeSetAttribute.apply(this, arguments);
  };

  // --- 2. Pop-up: onCreateWindow che nega ---------------------------------
  window.open = function (u) {
    send({ kind: 'popup', url: u ? absolute(u) : '' });
    return null;
  };

  // --- 3. Finestre di sistema che bloccano tutto --------------------------
  window.alert = function () {};
  window.confirm = function () { return false; };
  window.prompt = function () { return null; };

  // --- 4. shouldOverrideUrlLoading: niente salti fuori dominio ------------
  function guard(e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    var href = a.getAttribute('href') || '';
    if (href.charAt(0) === '#' || /^(javascript|mailto|tel):/i.test(href)) return;
    var abs = absolute(href);
    var h = hostOf(abs);
    var allowed = h === HOST || h.slice(-(HOST.length + 1)) === '.' + HOST;
    e.preventDefault();
    send({ kind: 'navigation', url: abs, allowed: allowed });
  }
  document.addEventListener('click', guard, true);

  document.addEventListener('submit', function (e) { e.preventDefault(); }, true);

  // Un redirect via meta refresh o via location: dentro alla sandbox la
  // navigazione della pagina intera è comunque nostra, ma segnalarla permette
  // alla barra dell'indirizzo di restare vera.
  try {
    var metas = document.querySelectorAll('meta[http-equiv="refresh" i]');
    for (var m = 0; m < metas.length; m++) metas[m].remove();
  } catch (e) {}

  // --- 5. MutationObserver: via le sovrapposizioni ------------------------
  var cleaned = 0;
  function isOverlay(el) {
    if (!el || el.nodeType !== 1) return false;
    var tag = el.tagName;
    if (tag === 'IFRAME') {
      var src = el.getAttribute('src') || '';
      return src ? isBlocked(src) : false;
    }
    if (tag !== 'DIV' && tag !== 'SECTION' && tag !== 'ASIDE') return false;
    var id = (el.id || '') + ' ' + (typeof el.className === 'string' ? el.className : '');
    if (/(^|[-_\\s])(ads?|advert|banner|popup|pop-up|interstitial|overlay|modal-ad|sponsor)([-_\\s]|$)/i.test(id)) return true;
    // Una copertura a schermo intero con z-index alto: il vestito standard di
    // un pop-under. Si guarda lo stile in linea, che è dove lo scrivono, per
    // non pagare un getComputedStyle su ogni nodo aggiunto.
    var style = el.getAttribute('style') || '';
    return /position\\s*:\\s*fixed/i.test(style) && /z-index\\s*:\\s*(9\\d{3,}|\\d{6,})/i.test(style);
  }

  function sweep(root) {
    if (isOverlay(root)) { try { root.remove(); cleaned++; } catch (e) {} return; }
    if (!root.querySelectorAll) return;
    var nodes = root.querySelectorAll('div,section,aside,iframe');
    for (var i = 0; i < nodes.length; i++) {
      if (isOverlay(nodes[i])) { try { nodes[i].remove(); cleaned++; } catch (e) {} }
    }
  }

  function start() {
    sweep(document.body || document.documentElement);
    try {
      new MutationObserver(function (records) {
        var before = cleaned;
        for (var i = 0; i < records.length; i++) {
          for (var j = 0; j < records[i].addedNodes.length; j++) sweep(records[i].addedNodes[j]);
        }
        if (cleaned !== before) send({ kind: 'cleaned', count: cleaned });
      }).observe(document.documentElement, { childList: true, subtree: true });
    } catch (e) {}
    if (cleaned) send({ kind: 'cleaned', count: cleaned });
    send({ kind: 'ready' });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
`;
}

/**
 * Il documento da mettere in `srcdoc`: la pagina letta, con lo script davanti.
 *
 * Il `<base>` è indispensabile e va messo per primo: senza, ogni indirizzo
 * relativo della pagina — fogli di stile, immagini, e soprattutto gli script
 * che poi chiederanno il manifest — verrebbe risolto contro `about:srcdoc` e
 * non contro il sito, e non si caricherebbe niente. Un `<base>` già presente
 * nella pagina si toglie, altrimenti vincerebbe il primo dei due e sarebbe il
 * suo.
 */
export function buildHookedDocument(html: string, pageUrl: string): string {
  const host = hostOf(pageUrl);
  const script = `<script>${injectedSource(host, BLOCKED_HOSTS)}</script>`;
  const base = `<base href="${pageUrl.replace(/"/g, "&quot;")}">`;

  const withoutBase = html.replace(/<base\b[^>]*>/gi, "");

  // Dopo `<head>` quando c'è: è il punto più in alto in cui uno script può
  // stare, ed è ciò che garantisce che il nostro giri prima di ogni altro.
  const headMatch = withoutBase.match(/<head[^>]*>/i);
  if (headMatch && headMatch.index !== undefined) {
    const at = headMatch.index + headMatch[0].length;
    return withoutBase.slice(0, at) + base + script + withoutBase.slice(at);
  }
  return base + script + withoutBase;
}

/**
 * I permessi del riquadro in lettura hookata.
 *
 * `allow-same-origin` non c'è, e non è una dimenticanza: è la riga che tiene il
 * JavaScript del sito fuori dalla nostra origine. Vedi il commento in testa.
 */
export const HOOKED_SANDBOX = "allow-scripts";
