import { useState } from "react";
import { Sheet } from "./Sheet";
import { useLibrary } from "../store/useLibrary";
import { DNS_FAQ, PLATFORM_STEPS, PORTS, RESOLVERS } from "../lib/dnsGuide";
import { DOH_LABEL, JSON_CAPABLE, resolveEverywhere } from "../lib/doh";
import type { DohResult } from "../lib/doh";
import { ChevronRightIcon } from "./icons";
import { t } from "../lib/i18n";

/**
 * La scheda di riferimento sul DNS cifrato.
 *
 * Solo dati e istruzioni: quali sono i resolver pubblici, quali endpoint DoH e
 * DoT pubblicano, e dove si scrivono su ciascun sistema. Il perché di ogni voce
 * sta in `lib/dnsGuide.ts`, insieme a cosa questa scheda non è.
 */

export function DnsGuideButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn btn-plain btn-sm -ml-3 gap-0.5"
      >
        {t("DnsGuide.dns_cifrato_doh_dot")}
        <ChevronRightIcon size={16} />
      </button>
      {open && <DnsGuideSheet onClose={() => setOpen(false)} />}
    </>
  );
}

/**
 * Interroga un nome via DoH, dal browser.
 *
 * Funziona perché Cloudflare e Google servono la variante JSON del resolver con
 * `Access-Control-Allow-Origin: *` — vedi `lib/doh.ts`. Non cambia come il
 * browser risolve i nomi: risponde alla domanda diagnostica che finora l'app
 * poteva solo girare all'utente, cioè se un host muto sia spento o sia un nome
 * che, sulla risoluzione in uso, non diventa un indirizzo.
 */
function Lookup() {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<DohResult[] | null>(null);

  async function run() {
    if (!name.trim()) return;
    setBusy(true);
    setResults(null);
    setResults(await resolveEverywhere(name));
    setBusy(false);
  }

  return (
    <section>
      <h3 className="mb-1 text-base font-semibold text-text">
        {t("DnsGuide.prova_un_nome")}
      </h3>
      <p className="mb-3 text-sm text-text-muted">
        {t("DnsGuide.chiede_a_cloudflare_e")}
      </p>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run();
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          inputMode="url"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-label={t("DnsGuide.nome_da_risolvere")}
          placeholder={t("DnsGuide.esempio_tld")}
          className="field field-sm min-w-0 flex-1 font-mono"
        />
        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="btn btn-primary btn-sm shrink-0"
        >
          {busy ? t("DnsGuide.chiedo") : t("DnsGuide.risolvi")}
        </button>
      </form>
      {results && (
        <ul className="mt-3 flex flex-col gap-2">
          {results.map((r) => (
            <li key={r.resolver} className="rounded-md bg-surface-2 px-4 py-3">
              <p className="text-sm text-text">
                <span className="font-medium">{r.resolver}</span>{" "}
                <span className="text-text-muted">— {DOH_LABEL[r.verdict]}</span>
                {r.ms > 0 && <span className="tabular text-text-muted"> · {r.ms} {t("DnsGuide.ms")}</span>}
              </p>
              {r.addresses.length > 0 && (
                <p className="mt-0.5 break-all font-mono text-xs text-text-muted">
                  {r.addresses.join(", ")}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function DnsGuideSheet({ onClose }: { onClose: () => void }) {
  const pushToast = useLibrary((s) => s.pushToast);

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      pushToast("success", t("DnsGuide.copiato"));
    } catch {
      pushToast("error", t("DnsGuide.il_browser_non_ha"));
    }
  }

  return (
    <Sheet onClose={onClose} titleId="dns-guide-title" maxWidthClass="max-w-2xl">
      <div className="flex flex-col gap-8 p-5 pt-8 sm:p-6">
        <div>
          <h2 id="dns-guide-title" className="t-title text-text">
            {t("DnsGuide.dns_cifrato")}
          </h2>
          <p className="mt-2 text-sm text-text-muted">
            {t("DnsGuide.il_dns_e_il")}{" "}
            <strong className="font-medium text-text-muted">{t("DnsGuide.doh")}</strong> {t("DnsGuide.dns_su_https_e")}{" "}
            <strong className="font-medium text-text-muted">{t("DnsGuide.dot")}</strong> {t("DnsGuide.dns_su_tls_cifrano")}
          </p>
        </div>

        <Lookup />

        <section>
          <h3 className="mb-1 text-base font-semibold text-text">
            {t("DnsGuide.resolver_pubblici")}
          </h3>
          <p className="mb-3 text-sm text-text-muted">
            {t("DnsGuide.doh_viaggia_sulla_porta")} {PORTS.doh}{t("DnsGuide.la_stessa_di_tutto")} {PORTS.dot}{t("DnsGuide.piu_pulita_da_amministrare")}
          </p>
          <div className="-mx-1 overflow-x-auto px-1">
            <table className="w-full min-w-[36rem] border-collapse text-left text-xs">
              <thead>
                <tr className="text-text-muted shadow-[inset_0_-1px_0_var(--separator)]">
                  <th className="py-1.5 pr-3 font-medium">{t("DnsGuide.servizio")}</th>
                  <th className="py-1.5 pr-3 font-medium">{t("DnsGuide.ipv4")}</th>
                  <th className="py-1.5 pr-3 font-medium">{t("DnsGuide.doh")}</th>
                  <th className="py-1.5 font-medium">{t("DnsGuide.dot")}</th>
                </tr>
              </thead>
              <tbody>
                {RESOLVERS.map((r) => (
                  <tr key={r.name} className="align-top [&+&]:shadow-[inset_0_1px_0_var(--separator)]">
                    <td className="py-2 pr-3">
                      <span className="block font-medium text-text">
                        {r.name}
                        {/* Chi manda gli header CORS sulla variante JSON, cioè
                            chi la casella qui sopra può davvero interrogare. */}
                        {JSON_CAPABLE.has(r.name) && (
                          <span className="ml-1.5 text-xs font-normal text-text-muted">
                            {t("DnsGuide.interrogabile_da_qui")}
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block max-w-[14rem] text-xs leading-relaxed text-text-muted">
                        {r.note}
                      </span>
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs text-text-muted">
                      {r.ipv4.map((ip) => (
                        <button
                          key={ip}
                          type="button"
                          onClick={() => copy(ip)}
                          title={t("DnsGuide.copia")}
                          className="block hover:underline"
                        >
                          {ip}
                        </button>
                      ))}
                      {r.ipv6 && (
                        <span className="mt-1 block break-all text-xs text-text-faint">
                          {r.ipv6.join(" · ")}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      <button
                        type="button"
                        onClick={() => copy(r.doh)}
                        title={t("DnsGuide.copia")}
                        className="break-all text-left font-mono text-xs text-text-muted hover:underline"
                      >
                        {r.doh}
                      </button>
                    </td>
                    <td className="py-2">
                      <button
                        type="button"
                        onClick={() => copy(r.dot)}
                        title={t("DnsGuide.copia")}
                        className="break-all text-left font-mono text-xs text-text-muted hover:underline"
                      >
                        {r.dot}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-text-muted">{t("DnsGuide.tocca_un_valore_per")}</p>
        </section>

        <section>
          <h3 className="mb-1 text-base font-semibold text-text">
            {t("DnsGuide.dove_si_scrivono")}
          </h3>
          <div className="flex flex-col gap-2.5">
            {PLATFORM_STEPS.map((p) => (
              <div key={p.name} className="rounded-md bg-surface-2 p-4">
                <p className="text-sm font-medium text-text">{p.name}</p>
                <p className="mt-0.5 text-xs text-text-muted">{p.supports}</p>
                <ol className="mt-2 list-decimal pl-4 text-sm text-text-muted">
                  {p.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h3 className="mb-1 text-base font-semibold text-text">
            {t("DnsGuide.domande_che_tornano")}
          </h3>
          <dl className="flex flex-col gap-4">
            {DNS_FAQ.map((f) => (
              <div key={f.q}>
                <dt className="text-sm font-medium text-text">{f.q}</dt>
                <dd className="mt-0.5 text-sm text-text-muted">{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>

        <button
          type="button"
          onClick={onClose}
          className="btn btn-secondary btn-sm"
        >
          {t("DnsGuide.chiudi")}
        </button>
      </div>
    </Sheet>
  );
}
