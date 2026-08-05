import { useState } from "react";
import { Sheet } from "./Sheet";
import { useLibrary } from "../store/useLibrary";
import { DNS_FAQ, PLATFORM_STEPS, RESOLVERS } from "../lib/dnsGuide";

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
        className="text-xs underline-offset-2 hover:underline"
        style={{ color: "var(--accent-text)" }}
      >
        DNS cifrato: DoH, DoT e i resolver pubblici →
      </button>
      {open && <DnsGuideSheet onClose={() => setOpen(false)} />}
    </>
  );
}

function DnsGuideSheet({ onClose }: { onClose: () => void }) {
  const pushToast = useLibrary((s) => s.pushToast);

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      pushToast("success", "Copiato.");
    } catch {
      pushToast("error", "Il browser non ha concesso gli appunti.");
    }
  }

  return (
    <Sheet onClose={onClose} titleId="dns-guide-title" maxWidthClass="max-w-2xl">
      <div className="flex flex-col gap-5 p-5 pt-8 sm:p-6">
        <div>
          <h2 id="dns-guide-title" className="font-display text-xl font-semibold text-text">
            DNS cifrato
          </h2>
          <p className="mt-1.5 text-xs leading-relaxed text-text-faint">
            Il DNS è il passaggio in cui un nome diventa un indirizzo, e per trent'anni è viaggiato
            in chiaro: chiunque sia sul percorso legge cosa stai per aprire, e su una rete che non è
            tua può anche rispondere al posto del resolver.{" "}
            <strong className="font-medium text-text-muted">DoH</strong> (DNS su HTTPS) e{" "}
            <strong className="font-medium text-text-muted">DoT</strong> (DNS su TLS) cifrano quella
            domanda. Cambiare resolver sposta chi la vede — non ti rende anonimo e non cambia cosa è
            lecito guardare.
          </p>
        </div>

        <section>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-text-faint">
            Resolver pubblici
          </h3>
          <div className="-mx-1 overflow-x-auto px-1">
            <table className="w-full min-w-[36rem] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-border text-text-faint">
                  <th className="py-1.5 pr-3 font-medium">Servizio</th>
                  <th className="py-1.5 pr-3 font-medium">IPv4</th>
                  <th className="py-1.5 pr-3 font-medium">DoH</th>
                  <th className="py-1.5 font-medium">DoT</th>
                </tr>
              </thead>
              <tbody>
                {RESOLVERS.map((r) => (
                  <tr key={r.name} className="border-b border-border align-top last:border-0">
                    <td className="py-2 pr-3">
                      <span className="block font-medium text-text">{r.name}</span>
                      <span className="mt-0.5 block max-w-[14rem] text-[11px] leading-relaxed text-text-faint">
                        {r.note}
                      </span>
                    </td>
                    <td className="py-2 pr-3 font-mono text-[11px] text-text-muted">
                      {r.ipv4.map((ip) => (
                        <button
                          key={ip}
                          type="button"
                          onClick={() => copy(ip)}
                          title="Copia"
                          className="block hover:underline"
                        >
                          {ip}
                        </button>
                      ))}
                      <span className="mt-1 block break-all text-[10px] text-text-faint">
                        {r.ipv6.join(" · ")}
                      </span>
                    </td>
                    <td className="py-2 pr-3">
                      <button
                        type="button"
                        onClick={() => copy(r.doh)}
                        title="Copia"
                        className="break-all text-left font-mono text-[11px] text-text-muted hover:underline"
                      >
                        {r.doh}
                      </button>
                    </td>
                    <td className="py-2">
                      <button
                        type="button"
                        onClick={() => copy(r.dot)}
                        title="Copia"
                        className="break-all text-left font-mono text-[11px] text-text-muted hover:underline"
                      >
                        {r.dot}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-text-faint">Tocca un valore per copiarlo.</p>
        </section>

        <section>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-text-faint">
            Dove si scrivono
          </h3>
          <div className="flex flex-col gap-2.5">
            {PLATFORM_STEPS.map((p) => (
              <div key={p.name} className="rounded-sm border border-border bg-surface-2 p-3">
                <p className="text-sm font-medium text-text">{p.name}</p>
                <p className="mt-0.5 text-[11px] text-text-faint">{p.supports}</p>
                <ol className="mt-1.5 list-decimal pl-4 text-xs leading-relaxed text-text-muted">
                  {p.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-text-faint">
            Domande che tornano
          </h3>
          <dl className="flex flex-col gap-2.5">
            {DNS_FAQ.map((f) => (
              <div key={f.q}>
                <dt className="text-sm font-medium text-text">{f.q}</dt>
                <dd className="mt-0.5 text-xs leading-relaxed text-text-faint">{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>

        <button
          type="button"
          onClick={onClose}
          className="rounded-sm border border-border-strong px-3.5 py-2 text-xs text-text-muted hover:bg-surface-hover"
        >
          Chiudi
        </button>
      </div>
    </Sheet>
  );
}
