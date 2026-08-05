import { useEffect, useRef, useState } from "react";
import { useLinkHosts } from "../../store/useLinkHosts";
import { useWebViewer } from "../../store/useWebViewer";
import { useSettingsSheet } from "../../store/useSettingsSheet";
import { usePlayerSources } from "../../store/usePlayerSources";
import { useLibrary } from "../../store/useLibrary";
import { effectiveUrl, hostLabel, searchUrlsFor, buildQuery } from "../../lib/linkHost";
import { searchOnLinkHosts, outcomeMessage } from "../searchOnLinkHost";
import type { SearchOutcome } from "../searchOnLinkHost";
import type { Item } from "../../types";

/**
 * Il pannello «Siti» del player: cosa è successo quando ha cercato, e i tre
 * modi di prendere in mano la ricerca quando non è bastata.
 *
 * L'aggiunta e la modifica degli host non stanno qui, stanno in Impostazioni:
 * sono configurazione, si fanno una volta, e duplicarle in due posti che
 * scrivono lo stesso storage è il modo migliore per ritrovarsi due elenchi che
 * non coincidono. Qui c'è quello che ha senso solo davanti a un titolo — la
 * domanda che è stata posta, dove è stata posta, e cosa ha risposto.
 */

export function LinkHostPanel({
  item,
  outcome,
  busy,
}: {
  item: Item | null;
  outcome: SearchOutcome | null;
  busy: boolean;
}) {
  const hosts = useLinkHosts((s) => s.hosts);
  const openViewer = useWebViewer((s) => s.open);
  const openSettings = useSettingsSheet((s) => s.open);
  const patchSource = usePlayerSources((s) => s.patch);
  const pushToast = useLibrary((s) => s.pushToast);

  const [retrying, setRetrying] = useState(false);
  const [retryOutcome, setRetryOutcome] = useState<SearchOutcome | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);

  const enabled = hosts.filter((h) => h.enabled && h.url.trim());
  const shown = retryOutcome ?? outcome;

  if (!item) {
    return (
      <div className="pv-panel">
        <p className="pv-empty">
          Lo stream di test non è un titolo della libreria, quindi non c'è niente da cercare.
        </p>
      </div>
    );
  }

  async function retry() {
    if (!item) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setRetrying(true);
    setRetryOutcome(null);
    const result = await searchOnLinkHosts(item, enabled, controller.signal);
    if (controller.signal.aborted) return;
    setRetrying(false);
    setRetryOutcome(result);
    if (result.kind === "flusso") {
      // Scritto nella scheda del titolo invece che tenuto in memoria: un flusso
      // trovato una volta non ha motivo di essere ricercato al riavvio, e da lì
      // è la prima sorgente che il player guarda.
      patchSource(item.id, { manifestUrl: result.url });
      pushToast("success", "Flusso trovato e collegato al titolo.");
    }
  }

  return (
    <div className="pv-panel">
      <div className="pv-panel-header">
        <h3>Siti</h3>
        <button type="button" className="pv-btn-secondary" onClick={openSettings}>
          Gestisci in Impostazioni
        </button>
      </div>

      {enabled.length === 0 ? (
        <p className="pv-empty">
          Nessun Link Host attivo. Un Link Host è l'indirizzo di un sito su cui cercare: i metadati
          del titolo diventano la sua ricerca, e se la pagina che risponde contiene un .m3u8 finisce
          qui nel lettore. Si aggiunge in Impostazioni → Link Host.
        </p>
      ) : (
        <>
          <p className="pv-dim" style={{ fontSize: "0.8rem", lineHeight: 1.5 }}>
            La domanda per «{item.title}»:{" "}
            <span className="pv-mono">{buildQuery(item, enabled[0].recipe)}</span>
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {enabled.map((host) => {
              const urls = searchUrlsFor({ ...host, url: effectiveUrl(host) }, item);
              return (
                <div
                  key={host.id}
                  style={{
                    border: "1px solid var(--pv-border)",
                    borderRadius: 8,
                    padding: 10,
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <strong style={{ fontSize: "0.9rem" }}>{host.name}</strong>
                    <span className="pv-mono pv-dim">{hostLabel(effectiveUrl(host))}</span>
                  </div>
                  {urls[0] && (
                    <span className="pv-mono pv-dim" style={{ wordBreak: "break-all", fontSize: "0.7rem" }}>
                      {urls[0]}
                      {urls.length > 1 && (
                        <span className="pv-dim" style={{ fontFamily: "inherit" }}>
                          {" "}
                          e altri {urls.length - 1} percorsi
                        </span>
                      )}
                    </span>
                  )}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {urls[0] && (
                      <button
                        type="button"
                        className="pv-btn-tiny"
                        onClick={() => openViewer(urls[0], { itemId: item.id, title: item.title })}
                      >
                        Apri la ricerca nel Web Viewer
                      </button>
                    )}
                    <button
                      type="button"
                      className="pv-btn-tiny"
                      onClick={() =>
                        openViewer(effectiveUrl(host), { itemId: item.id, title: item.title })
                      }
                    >
                      Apri il sito
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button type="button" onClick={retry} disabled={retrying || busy}>
              {retrying || busy ? "Cerco…" : "Cerca di nuovo"}
            </button>
            {shown && shown.kind !== "niente-host" && (
              <span className="pv-dim" style={{ fontSize: "0.78rem", flex: 1, minWidth: 200, lineHeight: 1.45 }}>
                {outcomeMessage(shown)}
              </span>
            )}
          </div>

          {shown?.kind === "solo-pagina" && shown.candidates.length > 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span className="pv-dim" style={{ fontSize: "0.78rem" }}>
                Altre pagine che somigliano al titolo:
              </span>
              {shown.candidates.slice(1).map((c) => (
                <button
                  key={c.url}
                  type="button"
                  className="pv-btn-tiny"
                  style={{ textAlign: "left" }}
                  onClick={() => openViewer(c.url, { itemId: item.id, title: item.title })}
                >
                  {c.label || c.url}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      <p className="pv-dim" style={{ fontSize: "0.72rem", lineHeight: 1.5 }}>
        I siti si interrogano solo dopo che i tuoi indirizzi non hanno dato niente. La lettura di
        una pagina di un altro dominio dipende dai suoi header CORS: quando mancano, il browser la
        blocca e resta il Web Viewer, che quella pagina la mostra senza leggerla.
      </p>
    </div>
  );
}
