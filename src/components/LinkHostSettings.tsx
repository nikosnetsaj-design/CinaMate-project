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
import { t } from "../lib/i18n";

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
      pushToast("error", t("LinkHostSettings.non_ci_stanno_altri"));
      return;
    }
    setName("");
    setUrl("");
    pushToast("success", t("LinkHostSettings.aggiunto", { v0: created.name }));
  }

  return (
    <div>
      <span className="mb-3 block text-base font-semibold text-text">
        {hosts.length > 0 ? t("LinkHostSettings.i_tuoi_siti") : t("LinkHostSettings.nessun_sito_configurato")}
      </span>

      <form onSubmit={submit} className="mb-3 flex flex-col gap-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          inputMode="url"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-label={t("LinkHostSettings.indirizzo_del_sito")}
          placeholder="https://sito.tld"
          className={INPUT}
        />
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label={t("LinkHostSettings.nome")}
            placeholder={t("LinkHostSettings.come_lo_chiami_facoltativo")}
            className={`${INPUT} font-sans`}
          />
          <button
            type="submit"
            disabled={!url.trim()}
            className="btn btn-primary btn-sm shrink-0"
          >
            {t("LinkHostSettings.aggiungi")}
          </button>
        </div>
      </form>

      {hosts.length === 0 ? (
        <p className="rounded-md bg-surface-2 px-4 py-3 text-sm text-text-muted">
          {t("LinkHostSettings.nessun_link_host_basta")}
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
        {showHelp ? t("LinkHostSettings.nascondi_i_segnaposto") : t("LinkHostSettings.come_si_scrive_un")}
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
          {t("LinkHostSettings.come_funziona")}
        </h4>
        <p className="text-sm text-text-muted">
          {t("LinkHostSettings.cinemate_non_ospita_ne")}{" "}
          <strong className="font-medium text-text-muted">{t("LinkHostSettings.sito")}</strong> {t("LinkHostSettings.che_indichi_tu_usato")}{" "}
          <strong className="font-medium text-text-muted">{t("LinkHostSettings.guarda")}</strong> {t("LinkHostSettings.su_un_titolo_l")}{" "}
          <span className="font-mono">.m3u8</span>{t("LinkHostSettings.lo_manda_al_lettore")}
        </p>
        <p className="mt-2 text-sm text-text-muted">
          {t("LinkHostSettings.l_app_non_conosce")}
        </p>
      </div>

      {/* Un avviso, non un errore: il colore dell'attenzione sta sull'icona,
          non su una cornice rossa intorno a un paragrafo. */}
      <div className="rounded-lg bg-surface-2 p-4">
        <h4 className="mb-2 flex items-center gap-2 text-base font-semibold text-text">
          <span aria-hidden="true" style={{ color: "var(--warning)" }}>
            <WarningIcon />
          </span>
          {t("LinkHostSettings.attenzione")}
        </h4>
        <p className="text-sm text-text-muted">
          {t("LinkHostSettings.accedere_a_materiale_protetto")}
        </p>
      </div>
    </div>
  );
}

function PatternHelp() {
  return (
    <div className="mt-3 rounded-md bg-surface-2 p-4">
      <p className="mb-3 text-sm text-text-muted">
        {t("LinkHostSettings.se_sai_gia_com")}
      </p>
      {[
        { label: t("LinkHostSettings.ricerca"), list: SEARCH_LAYOUTS },
        { label: t("LinkHostSettings.percorso_diretto_film"), list: FILM_PATH_LAYOUTS },
        { label: t("LinkHostSettings.percorso_diretto_episodi"), list: EPISODE_PATH_LAYOUTS },
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
        {t("LinkHostSettings.la_stagione_vale_1")}{" "}
        <strong className="font-medium text-text-muted">{t("LinkHostSettings.siti")}</strong> {t("LinkHostSettings.del_player_ha_due")}
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
      pushToast("info", t("LinkHostSettings.risponde_da", { v0: host.name, v1: hostLabel(probe.finalUrl) }));
    }
  }

  async function hunt() {
    setHunting(true);
    setMirrors(null);
    const found = await findMirrors(effectiveUrl(host));
    setHunting(false);
    setMirrors(found);
    if (!found.length) pushToast("info", t("LinkHostSettings.nessun_nome_alternativo_risolve"));
  }

  return (
    <li className="rounded-md bg-surface-2 p-3">
      <div className="flex items-start gap-2">
        <div className="flex shrink-0 flex-col gap-0.5">
          <button
            type="button"
            onClick={() => move(host.id, -1)}
            disabled={index === 0}
            aria-label={t("LinkHostSettings.sposta_in_alto", { v0: host.name })}
            className="flex h-7 w-9 items-center justify-center rounded-xs text-text-muted transition-colors hover:text-text disabled:opacity-25"
          >
            <ChevronUpIcon size={16} />
          </button>
          <button
            type="button"
            onClick={() => move(host.id, 1)}
            disabled={index === total - 1}
            aria-label={t("LinkHostSettings.sposta_in_basso", { v0: host.name })}
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
          aria-label={t("LinkHostSettings.attivo", { v0: host.name })}
          onClick={() => toggle(host.id)}
          className="switch mt-0.5"
        />
      </div>

      {host.movedTo && (
        <div className="mt-3 rounded-sm bg-surface p-3">
          <p className="text-xs leading-relaxed text-text-muted">
            {t("LinkHostSettings.ha_traslocato")} <span className="font-mono">{hostLabel(host.url)}</span> {t("LinkHostSettings.ora_rimanda_a")}{" "}
            <span className="font-mono">{hostLabel(host.movedTo)}</span>.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => acceptMove(host.id)}
              className="btn btn-primary btn-sm"
            >
              {t("LinkHostSettings.aggiorna_l_indirizzo")}
            </button>
            <button
              type="button"
              onClick={() => dismissMove(host.id)}
              className="btn btn-secondary btn-sm bg-surface-hover"
            >
              {t("LinkHostSettings.lascia_com_e")}
            </button>
          </div>
        </div>
      )}

      {preview && (
        <p className="mt-2 break-all font-mono text-xs leading-relaxed text-text-muted">
          {t("LinkHostSettings.cerca")} {preview}
          {others > 0 && <span className="font-sans"> {t("LinkHostSettings.e_altri")} {others} {t("LinkHostSettings.percorsi_finche_uno_risponde")}</span>}
        </p>
      )}

      {status && (
        <p className="mt-1.5 text-xs text-text-muted">
          <span className="text-text">{REDIRECT_LABEL[status]}.</span> {REDIRECT_HINT[status]}
          {addresses.length > 0 && (
            <span className="font-mono"> {t("LinkHostSettings.risolve_in")} {addresses.join(", ")}.</span>
          )}
        </p>
      )}

      {mirrors && mirrors.length > 0 && (
        <div className="mt-3 rounded-sm bg-surface p-3">
          <p className="mb-2 text-xs text-text-muted">
            {t("LinkHostSettings.lo_stesso_nome_risolve")}
          </p>
          <div className="flex flex-col gap-1">
            {mirrors.map((m) => (
              <div key={m.url} className="flex flex-wrap items-center gap-1.5">
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-text-muted">
                  {hostLabel(m.url)} {m.answers ? t("LinkHostSettings.risponde") : t("LinkHostSettings.non_risponde")}
                </span>
                <button
                  type="button"
                  onClick={() => openViewer(m.url)}
                  className="btn btn-secondary btn-sm bg-surface-hover"
                >
                  {t("LinkHostSettings.guarda")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    update(host.id, { url: m.url, movedTo: undefined });
                    setMirrors(null);
                    pushToast("success", t("LinkHostSettings.indirizzo_aggiornato_a", { v0: hostLabel(m.url) }));
                  }}
                  className="btn btn-secondary btn-sm bg-surface-hover"
                >
                  {t("LinkHostSettings.usa_questo")}
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
          {open ? t("LinkHostSettings.chiudi") : t("LinkHostSettings.modifica")}
        </button>
        <button
          type="button"
          onClick={check}
          disabled={checking}
          className="btn btn-secondary btn-sm bg-surface-hover disabled:opacity-50"
        >
          {checking ? t("LinkHostSettings.controllo") : t("LinkHostSettings.controlla_l_indirizzo")}
        </button>
        <button
          type="button"
          onClick={hunt}
          disabled={hunting}
          title={t("LinkHostSettings.cerca_lo_stesso_nome")}
          className="btn btn-secondary btn-sm bg-surface-hover disabled:opacity-50"
        >
          {hunting ? t("LinkHostSettings.cerco") : t("LinkHostSettings.cerca_un_nome_alternativo")}
        </button>
        <button
          type="button"
          onClick={() => openViewer(effectiveUrl(host))}
          className="btn btn-secondary btn-sm bg-surface-hover"
        >
          {t("LinkHostSettings.apri_nel_web_viewer")}
        </button>
        <button
          type="button"
          onClick={() => remove(host.id)}
          className="btn btn-secondary btn-sm bg-surface-hover"
        >
          {t("LinkHostSettings.rimuovi")}
        </button>
      </div>

      {open && (
        <div className="mt-3 flex flex-col gap-3 pt-3 shadow-[inset_0_1px_0_var(--separator)]">
          <label className="flex flex-col gap-1.5 text-xs font-medium text-text-muted">
            {t("LinkHostSettings.nome")}
            <input
              value={host.name}
              onChange={(e) => update(host.id, { name: e.target.value })}
              className={`${INPUT} font-sans`}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-medium text-text-muted">
            {t("LinkHostSettings.indirizzo")}
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
            {t("LinkHostSettings.percorso_di_ricerca_vuoto")}
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
            <legend className="mb-1.5 text-xs font-medium text-text-muted">{t("LinkHostSettings.com_e_fatto_il")}</legend>
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
            <legend className="mb-1.5 text-xs font-medium text-text-muted">{t("LinkHostSettings.cosa_finisce_nella_domanda")}</legend>
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
