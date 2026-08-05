import { useState } from "react";
import type { FormEvent } from "react";
import { useLinkHosts } from "../store/useLinkHosts";
import { useWebViewer } from "../store/useWebViewer";
import { useLibrary } from "../store/useLibrary";
import type { LinkHost, QueryRecipe } from "../lib/linkHost";
import {
  LINK_HOST_TOKENS,
  QUERY_RECIPES,
  SEARCH_LAYOUTS,
  effectiveUrl,
  hostLabel,
  previewSearchCount,
  previewSearchUrl,
} from "../lib/linkHost";
import { REDIRECT_HINT, REDIRECT_LABEL, probeRedirect } from "../lib/hostRedirect";
import type { RedirectStatus } from "../lib/hostRedirect";

/**
 * Il pannello dei Link Host in Impostazioni.
 *
 * Sta accanto a «Indirizzi delle tue sorgenti» e non dentro, perché le due
 * cose rispondono a domande diverse: là scrivi *dove sta il file*, qui scrivi
 * *chi interrogare*. Confonderle avrebbe voluto dire una casella che a volte
 * viene provata come percorso e a volte come ricerca, senza che si capisca
 * quando.
 */

const INPUT =
  "w-full rounded-sm border border-border-strong bg-surface px-3 py-2 font-mono text-xs text-text placeholder:text-text-faint focus:border-accent";

export function LinkHostSettings() {
  const hosts = useLinkHosts((s) => s.hosts);
  const add = useLinkHosts((s) => s.add);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [showHelp, setShowHelp] = useState(false);
  const pushToast = useLibrary((s) => s.pushToast);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    const created = add({ name, url });
    if (!created) {
      pushToast("error", "Non ci stanno altri Link Host.");
      return;
    }
    setName("");
    setUrl("");
    pushToast("success", `«${created.name}» aggiunto.`);
  }

  return (
    <div>
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-faint">
        Link Host
      </span>
      <p className="mb-2.5 text-xs leading-relaxed text-text-faint">
        L'indirizzo di un <strong className="font-medium text-text-muted">sito</strong> su cui
        cercare, invece della cartella da cui leggere. Quando premi{" "}
        <strong className="font-medium text-text-muted">Guarda</strong> su un titolo, CineMate
        concatena i suoi metadati — titolo, anno, stagione ed episodio — li trasforma nella ricerca
        del sito, legge la pagina che risponde e, se ci trova un{" "}
        <span className="font-mono">.m3u8</span>, lo manda al lettore senza farti vedere la pagina.
        Se non ci arriva, resta il Web Viewer per cercare a mano.
      </p>
      <p className="mb-2.5 text-xs leading-relaxed text-text-faint">
        CineMate non conosce nessun sito e non ne propone: la lista è vuota finché non ci scrivi
        qualcosa tu, e quello che ci scrivi resta su questo dispositivo. Quello che ci metti, e cosa
        ne fai, è una tua responsabilità.
      </p>

      <form onSubmit={submit} className="mb-3 flex flex-col gap-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          inputMode="url"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-label="Indirizzo del sito"
          placeholder="https://sito.tld"
          className={INPUT}
        />
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="Nome"
            placeholder="Come lo chiami (facoltativo)"
            className={`${INPUT} font-sans`}
          />
          <button
            type="submit"
            disabled={!url.trim()}
            className="shrink-0 rounded-sm px-3.5 py-2 text-xs font-semibold disabled:opacity-50"
            style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
          >
            Aggiungi
          </button>
        </div>
      </form>

      {hosts.length === 0 ? (
        <p className="rounded-sm border border-dashed border-border-strong px-3 py-3 text-xs leading-relaxed text-text-faint">
          Nessun Link Host. Basta l'indirizzo nudo del sito: i percorsi di ricerca soliti li prova
          lui, uno dopo l'altro, finché uno risponde.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {hosts.map((host, i) => (
            <HostRow key={host.id} host={host} index={i} total={hosts.length} />
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => setShowHelp((v) => !v)}
        aria-expanded={showHelp}
        className="mt-2.5 text-xs underline-offset-2 hover:underline"
        style={{ color: "var(--accent-text)" }}
      >
        {showHelp ? "Nascondi i segnaposto" : "Come si scrive un percorso di ricerca"}
      </button>
      {showHelp && <PatternHelp />}
    </div>
  );
}

function PatternHelp() {
  return (
    <div className="mt-2 rounded-sm border border-border bg-surface-2 p-3">
      <p className="mb-2 text-xs leading-relaxed text-text-faint">
        Se sai già com'è fatta la ricerca del sito, scrivila e sarà l'unica provata. Altrimenti si
        provano queste, in ordine:
      </p>
      <ul className="mb-3 flex flex-wrap gap-1.5">
        {SEARCH_LAYOUTS.map((layout) => (
          <li key={layout} className="rounded-full bg-surface-hover px-2 py-0.5 font-mono text-[10px] text-text-muted">
            {layout}
          </li>
        ))}
      </ul>
      <dl className="flex flex-col gap-1.5">
        {LINK_HOST_TOKENS.map((t) => (
          <div key={t.token} className="flex flex-wrap items-baseline gap-x-2 text-xs">
            <dt className="font-mono text-text-muted">{t.token}</dt>
            <dd className="text-text-faint">
              {t.label} — <span className="font-mono">{t.example}</span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function HostRow({ host, index, total }: { host: LinkHost; index: number; total: number }) {
  const update = useLinkHosts((s) => s.update);
  const remove = useLinkHosts((s) => s.remove);
  const move = useLinkHosts((s) => s.move);
  const toggle = useLinkHosts((s) => s.toggle);
  const acceptMove = useLinkHosts((s) => s.acceptMove);
  const dismissMove = useLinkHosts((s) => s.dismissMove);
  const openViewer = useWebViewer((s) => s.open);
  const pushToast = useLibrary((s) => s.pushToast);

  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState<RedirectStatus | null>(null);

  const preview = previewSearchUrl(host);
  const others = Math.max(previewSearchCount(host) - 1, 0);

  async function check() {
    setChecking(true);
    setStatus(null);
    const probe = await probeRedirect(effectiveUrl(host));
    setChecking(false);
    setStatus(probe.status);
    update(host.id, { lastCheckedAt: probe.checkedAt });
    if (probe.status === "traslocato" && probe.finalUrl) {
      update(host.id, { movedTo: probe.finalUrl });
      pushToast("info", `«${host.name}» risponde da ${hostLabel(probe.finalUrl)}.`);
    }
  }

  return (
    <li className="rounded-sm border border-border bg-surface-2 p-3">
      <div className="flex items-start gap-2">
        <div className="flex shrink-0 flex-col gap-0.5">
          <button
            type="button"
            onClick={() => move(host.id, -1)}
            disabled={index === 0}
            aria-label={`Sposta ${host.name} in alto`}
            className="rounded-sm border border-border-strong px-1.5 text-[10px] text-text-muted disabled:opacity-30"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => move(host.id, 1)}
            disabled={index === total - 1}
            aria-label={`Sposta ${host.name} in basso`}
            className="rounded-sm border border-border-strong px-1.5 text-[10px] text-text-muted disabled:opacity-30"
          >
            ↓
          </button>
        </div>

        <div className="min-w-0 flex-1">
          <p className={`truncate text-sm ${host.enabled ? "text-text" : "text-text-faint line-through"}`}>
            {host.name}
          </p>
          <p className="truncate font-mono text-[11px] text-text-faint">{hostLabel(effectiveUrl(host))}</p>
        </div>

        <label className="flex shrink-0 items-center gap-1.5 text-xs text-text-faint">
          <input type="checkbox" checked={host.enabled} onChange={() => toggle(host.id)} />
          Attivo
        </label>
      </div>

      {host.movedTo && (
        <div className="mt-2 rounded-sm border border-accent/50 bg-surface p-2.5">
          <p className="text-xs leading-relaxed text-text-muted">
            Ha traslocato: <span className="font-mono">{hostLabel(host.url)}</span> ora rimanda a{" "}
            <span className="font-mono">{hostLabel(host.movedTo)}</span>.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => acceptMove(host.id)}
              className="rounded-sm px-3 py-1.5 text-xs font-semibold"
              style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
            >
              Aggiorna l'indirizzo
            </button>
            <button
              type="button"
              onClick={() => dismissMove(host.id)}
              className="rounded-sm border border-border-strong px-3 py-1.5 text-xs text-text-muted hover:bg-surface-hover"
            >
              Lascia com'è
            </button>
          </div>
        </div>
      )}

      {preview && (
        <p className="mt-2 break-all font-mono text-[10px] leading-relaxed text-text-faint">
          Cerca {preview}
          {others > 0 && <span className="font-sans"> e altri {others} percorsi, finché uno risponde</span>}
        </p>
      )}

      {status && (
        <p className="mt-1.5 text-[11px] leading-relaxed text-text-faint">
          <span className="text-text-muted">{REDIRECT_LABEL[status]}.</span> {REDIRECT_HINT[status]}
        </p>
      )}

      <div className="mt-2 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="rounded-sm border border-border-strong px-2.5 py-1 text-[11px] text-text-muted hover:bg-surface-hover"
        >
          {open ? "Chiudi" : "Modifica"}
        </button>
        <button
          type="button"
          onClick={check}
          disabled={checking}
          className="rounded-sm border border-border-strong px-2.5 py-1 text-[11px] text-text-muted hover:bg-surface-hover disabled:opacity-50"
        >
          {checking ? "Controllo…" : "Controlla l'indirizzo"}
        </button>
        <button
          type="button"
          onClick={() => openViewer(effectiveUrl(host))}
          className="rounded-sm border border-border-strong px-2.5 py-1 text-[11px] text-text-muted hover:bg-surface-hover"
        >
          Apri nel Web Viewer
        </button>
        <button
          type="button"
          onClick={() => remove(host.id)}
          className="rounded-sm border border-border-strong px-2.5 py-1 text-[11px] text-text-faint hover:bg-surface-hover"
        >
          Rimuovi
        </button>
      </div>

      {open && (
        <div className="mt-2.5 flex flex-col gap-2 border-t border-border pt-2.5">
          <label className="flex flex-col gap-1 text-xs text-text-faint">
            Nome
            <input
              value={host.name}
              onChange={(e) => update(host.id, { name: e.target.value })}
              className={`${INPUT} font-sans`}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-text-faint">
            Indirizzo
            <input
              value={host.url}
              onChange={(e) => update(host.id, { url: e.target.value })}
              inputMode="url"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              className={INPUT}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-text-faint">
            Percorso di ricerca — vuoto significa «provali tu»
            <input
              value={host.searchPattern}
              onChange={(e) => update(host.id, { searchPattern: e.target.value })}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder="/?s={query+}"
              className={INPUT}
            />
          </label>
          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 text-xs text-text-faint">Cosa finisce nella domanda</legend>
            <div className="flex flex-wrap gap-1.5">
              {QUERY_RECIPES.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => update(host.id, { recipe: r.id as QueryRecipe })}
                  aria-pressed={host.recipe === r.id}
                  title={r.hint}
                  className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                    host.recipe === r.id
                      ? "border-accent text-text"
                      : "border-border-strong text-text-muted hover:bg-surface-hover"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-text-faint">
              {QUERY_RECIPES.find((r) => r.id === host.recipe)?.hint}
            </p>
          </fieldset>
        </div>
      )}
    </li>
  );
}
