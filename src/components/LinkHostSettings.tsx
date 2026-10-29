import { useState } from "react";
import type { FormEvent } from "react";
import { useLinkHosts } from "../store/useLinkHosts";
import { useWebViewer } from "../store/useWebViewer";
import { useLibrary } from "../store/useLibrary";
import type { LayoutFamily, LinkHost, QueryRecipe } from "../lib/linkHost";
import {
  EPISODE_PATH_LAYOUTS,
  FILM_PATH_LAYOUTS,
  LAYOUT_FAMILIES,
  LINK_HOST_TOKENS,
  QUERY_RECIPES,
  SEARCH_LAYOUTS,
  effectiveUrl,
  hostLabel,
  previewSearchCount,
  previewSearchUrl,
} from "../lib/linkHost";
import { REDIRECT_HINT, REDIRECT_LABEL, findMirrors, probeRedirect } from "../lib/hostRedirect";
import type { MirrorCandidate, RedirectStatus } from "../lib/hostRedirect";
import { ChevronDownIcon, ChevronUpIcon, InfoIcon, WarningIcon } from "./icons";

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
  "field field-sm w-full font-mono";

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
      <span className="mb-3 block text-base font-semibold text-text">
        {hosts.length > 0 ? "I tuoi siti" : "Nessun sito configurato"}
      </span>

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
            className="btn btn-primary btn-sm shrink-0"
          >
            Aggiungi
          </button>
        </div>
      </form>

      {hosts.length === 0 ? (
        <p className="rounded-md bg-surface-2 px-4 py-3 text-sm text-text-muted">
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
        className="btn btn-plain btn-sm -ml-3 mt-2"
      >
        {showHelp ? "Nascondi i segnaposto" : "Come si scrive un percorso di ricerca"}
      </button>
      {showHelp && <PatternHelp />}

      <HowItWorks />
    </div>
  );
}

/**
 * Le due schede in fondo: cosa fa questa funzione, e di chi è la
 * responsabilità di quello che ci si mette dentro.
 *
 * La spiegazione stava in due paragrafi grigi sopra al modulo, dove si legge
 * una volta sola — il giorno in cui la casella è vuota. Come schede in fondo
 * resta leggibile anche dopo, che è quando serve: uno strumento che va a
 * leggere un sito qualunque per conto tuo deve dire ogni volta cosa fa e cosa
 * non fa, e l'avviso non è un fastidio da nascondere una volta accettato.
 */
function HowItWorks() {
  return (
    <div className="mt-4 flex flex-col gap-3">
      <div className="rounded-lg bg-surface-2 p-4">
        <h4 className="mb-2 flex items-center gap-2 text-base font-semibold text-text">
          <span aria-hidden="true" className="text-text-muted">
            <InfoIcon />
          </span>
          Come funziona?
        </h4>
        <p className="text-sm text-text-muted">
          CineMate non ospita né fornisce alcun contenuto. Un Link Host è l'indirizzo di un{" "}
          <strong className="font-medium text-text-muted">sito</strong> che indichi tu, usato come
          punto di partenza tecnico per la ricerca: quando premi{" "}
          <strong className="font-medium text-text-muted">Guarda</strong> su un titolo, l'app
          concatena i suoi metadati — titolo, anno, stagione ed episodio — li trasforma nella
          ricerca di quel sito, legge la pagina che risponde e, se ci trova un{" "}
          <span className="font-mono">.m3u8</span>, lo manda al lettore. Se non ci arriva, resta il
          Web Viewer per cercare a mano.
        </p>
        <p className="mt-2 text-sm text-text-muted">
          L'app non conosce nessun sito e non ne propone: la lista è vuota finché non ci scrivi
          qualcosa tu, e quello che ci scrivi resta su questo dispositivo.
        </p>
      </div>

      {/* Un avviso, non un errore: il colore dell'attenzione sta sull'icona,
          non su una cornice rossa intorno a un paragrafo. */}
      <div className="rounded-lg bg-surface-2 p-4">
        <h4 className="mb-2 flex items-center gap-2 text-base font-semibold text-text">
          <span aria-hidden="true" style={{ color: "var(--warning)" }}>
            <WarningIcon />
          </span>
          Attenzione
        </h4>
        <p className="text-sm text-text-muted">
          Accedere a materiale protetto da copyright senza autorizzazione viola i termini di
          servizio dei siti e le leggi vigenti. CineMate non è affiliata a nessun Link Host e non
          verifica cosa ci sia dietro l'indirizzo che scrivi: quello che ci metti, e cosa ne fai, è
          una tua responsabilità.
        </p>
      </div>
    </div>
  );
}

function PatternHelp() {
  return (
    <div className="mt-3 rounded-md bg-surface-2 p-4">
      <p className="mb-3 text-sm text-text-muted">
        Se sai già com'è fatta la ricerca del sito, scrivila e sarà l'unica provata. Altrimenti si
        provano queste, in ordine — prima la ricerca, che perdona uno slug approssimativo, poi i
        percorsi diretti, più veloci quando indovinano e muti quando no:
      </p>
      {[
        { label: "Ricerca", list: SEARCH_LAYOUTS },
        { label: "Percorso diretto — film", list: FILM_PATH_LAYOUTS },
        { label: "Percorso diretto — episodi", list: EPISODE_PATH_LAYOUTS },
      ].map((group) => (
        <div key={group.label} className="mb-2">
          <span className="mb-1.5 block text-xs font-medium text-text-muted">
            {group.label}
          </span>
          <ul className="flex flex-wrap gap-1.5">
            {group.list.map((layout) => (
              <li
                key={layout}
                className="rounded-full bg-surface-hover px-2 py-0.5 font-mono text-xs text-text-muted"
              >
                {layout}
              </li>
            ))}
          </ul>
        </div>
      ))}
      <p className="mb-3 mt-2 text-sm text-text-muted">
        La stagione vale 1 se non la scrivi: la libreria conta gli episodi visti come un totale, non
        per stagione, e da «visti: 27» non si ricava se sia S02E03. Il pannello{" "}
        <strong className="font-medium text-text-muted">Siti</strong> del player ha due caselle per
        dirlo, ed è quello che rende raggiungibili i percorsi annidati per stagione.
      </p>
      <dl className="flex flex-col gap-1.5">
        {LINK_HOST_TOKENS.map((t) => (
          <div key={t.token} className="flex flex-wrap items-baseline gap-x-2 text-xs">
            <dt className="font-mono text-text-muted">{t.token}</dt>
            <dd className="text-text-muted">
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
  const [addresses, setAddresses] = useState<string[]>([]);
  const [hunting, setHunting] = useState(false);
  const [mirrors, setMirrors] = useState<MirrorCandidate[] | null>(null);

  const preview = previewSearchUrl(host);
  const others = Math.max(previewSearchCount(host) - 1, 0);

  async function check() {
    setChecking(true);
    setStatus(null);
    setAddresses([]);
    const probe = await probeRedirect(effectiveUrl(host));
    setChecking(false);
    setStatus(probe.status);
    setAddresses(probe.addresses ?? []);
    update(host.id, { lastCheckedAt: probe.checkedAt });
    if (probe.status === "traslocato" && probe.finalUrl) {
      update(host.id, { movedTo: probe.finalUrl });
      pushToast("info", `«${host.name}» risponde da ${hostLabel(probe.finalUrl)}.`);
    }
  }

  async function hunt() {
    setHunting(true);
    setMirrors(null);
    const found = await findMirrors(effectiveUrl(host));
    setHunting(false);
    setMirrors(found);
    if (!found.length) pushToast("info", "Nessun nome alternativo risolve.");
  }

  return (
    <li className="rounded-md bg-surface-2 p-3">
      <div className="flex items-start gap-2">
        <div className="flex shrink-0 flex-col gap-0.5">
          <button
            type="button"
            onClick={() => move(host.id, -1)}
            disabled={index === 0}
            aria-label={`Sposta ${host.name} in alto`}
            className="flex h-7 w-9 items-center justify-center rounded-xs text-text-muted transition-colors hover:text-text disabled:opacity-25"
          >
            <ChevronUpIcon size={16} />
          </button>
          <button
            type="button"
            onClick={() => move(host.id, 1)}
            disabled={index === total - 1}
            aria-label={`Sposta ${host.name} in basso`}
            className="flex h-7 w-9 items-center justify-center rounded-xs text-text-muted transition-colors hover:text-text disabled:opacity-25"
          >
            <ChevronDownIcon size={16} />
          </button>
        </div>

        <div className="min-w-0 flex-1">
          <p className={`truncate text-sm ${host.enabled ? "text-text" : "text-text-faint line-through"}`}>
            {host.name}
          </p>
          <p className="truncate font-mono text-xs text-text-faint">{hostLabel(effectiveUrl(host))}</p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={host.enabled}
          aria-label={`${host.name} attivo`}
          onClick={() => toggle(host.id)}
          className="switch mt-0.5"
        />
      </div>

      {host.movedTo && (
        <div className="mt-3 rounded-sm bg-surface p-3">
          <p className="text-xs leading-relaxed text-text-muted">
            Ha traslocato: <span className="font-mono">{hostLabel(host.url)}</span> ora rimanda a{" "}
            <span className="font-mono">{hostLabel(host.movedTo)}</span>.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => acceptMove(host.id)}
              className="btn btn-primary btn-sm"
            >
              Aggiorna l'indirizzo
            </button>
            <button
              type="button"
              onClick={() => dismissMove(host.id)}
              className="btn btn-secondary btn-sm bg-surface-hover"
            >
              Lascia com'è
            </button>
          </div>
        </div>
      )}

      {preview && (
        <p className="mt-2 break-all font-mono text-xs leading-relaxed text-text-muted">
          Cerca {preview}
          {others > 0 && <span className="font-sans"> e altri {others} percorsi, finché uno risponde</span>}
        </p>
      )}

      {status && (
        <p className="mt-1.5 text-xs text-text-muted">
          <span className="text-text">{REDIRECT_LABEL[status]}.</span> {REDIRECT_HINT[status]}
          {addresses.length > 0 && (
            <span className="font-mono"> Risolve in {addresses.join(", ")}.</span>
          )}
        </p>
      )}

      {mirrors && mirrors.length > 0 && (
        <div className="mt-3 rounded-sm bg-surface p-3">
          <p className="mb-2 text-xs text-text-muted">
            Lo stesso nome risolve anche sotto queste estensioni. Che un dominio esista non dice
            chi ci sia dietro: guardalo prima di adottarlo.
          </p>
          <div className="flex flex-col gap-1">
            {mirrors.map((m) => (
              <div key={m.url} className="flex flex-wrap items-center gap-1.5">
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-text-muted">
                  {hostLabel(m.url)} {m.answers ? "· risponde" : "· non risponde"}
                </span>
                <button
                  type="button"
                  onClick={() => openViewer(m.url)}
                  className="btn btn-secondary btn-sm bg-surface-hover"
                >
                  Guarda
                </button>
                <button
                  type="button"
                  onClick={() => {
                    update(host.id, { url: m.url, movedTo: undefined });
                    setMirrors(null);
                    pushToast("success", `Indirizzo aggiornato a ${hostLabel(m.url)}.`);
                  }}
                  className="btn btn-secondary btn-sm bg-surface-hover"
                >
                  Usa questo
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-2 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="btn btn-secondary btn-sm bg-surface-hover"
        >
          {open ? "Chiudi" : "Modifica"}
        </button>
        <button
          type="button"
          onClick={check}
          disabled={checking}
          className="btn btn-secondary btn-sm bg-surface-hover disabled:opacity-50"
        >
          {checking ? "Controllo…" : "Controlla l'indirizzo"}
        </button>
        <button
          type="button"
          onClick={hunt}
          disabled={hunting}
          title="Cerca lo stesso nome sotto altre estensioni di dominio"
          className="btn btn-secondary btn-sm bg-surface-hover disabled:opacity-50"
        >
          {hunting ? "Cerco…" : "Cerca un nome alternativo"}
        </button>
        <button
          type="button"
          onClick={() => openViewer(effectiveUrl(host))}
          className="btn btn-secondary btn-sm bg-surface-hover"
        >
          Apri nel Web Viewer
        </button>
        <button
          type="button"
          onClick={() => remove(host.id)}
          className="btn btn-secondary btn-sm bg-surface-hover"
        >
          Rimuovi
        </button>
      </div>

      {open && (
        <div className="mt-3 flex flex-col gap-3 pt-3 shadow-[inset_0_1px_0_var(--separator)]">
          <label className="flex flex-col gap-1.5 text-xs font-medium text-text-muted">
            Nome
            <input
              value={host.name}
              onChange={(e) => update(host.id, { name: e.target.value })}
              className={`${INPUT} font-sans`}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-medium text-text-muted">
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
          <label className="flex flex-col gap-1.5 text-xs font-medium text-text-muted">
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
            <legend className="mb-1.5 text-xs font-medium text-text-muted">Com'è fatto il sito</legend>
            <div className="flex flex-wrap gap-2">
              {LAYOUT_FAMILIES.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => update(host.id, { layout: l.id as LayoutFamily })}
                  aria-pressed={(host.layout ?? "entrambi") === l.id}
                  title={l.hint}
                  className="chip bg-surface aria-pressed:bg-text aria-pressed:text-bg"
                >
                  {l.label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-text-muted">
              {LAYOUT_FAMILIES.find((l) => l.id === (host.layout ?? "entrambi"))?.hint}
            </p>
          </fieldset>
          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1.5 text-xs font-medium text-text-muted">Cosa finisce nella domanda</legend>
            <div className="flex flex-wrap gap-2">
              {QUERY_RECIPES.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => update(host.id, { recipe: r.id as QueryRecipe })}
                  aria-pressed={host.recipe === r.id}
                  title={r.hint}
                  className="chip bg-surface aria-pressed:bg-text aria-pressed:text-bg"
                >
                  {r.label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-text-muted">
              {QUERY_RECIPES.find((r) => r.id === host.recipe)?.hint}
            </p>
          </fieldset>
        </div>
      )}
    </li>
  );
}
