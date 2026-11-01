import { useEffect, useRef, useState } from "react";
import { useLinkHosts } from "../../store/useLinkHosts";
import { useWebViewer } from "../../store/useWebViewer";
import { useSettingsSheet } from "../../store/useSettingsSheet";
import { usePlayerSources } from "../../store/usePlayerSources";
import { useLibrary } from "../../store/useLibrary";
import { effectiveUrl, hostLabel, searchUrlsFor, buildQuery, defaultPosition } from "../../lib/linkHost";
import { searchOnLinkHosts, outcomeMessage } from "../searchOnLinkHost";
import type { SearchOutcome } from "../searchOnLinkHost";
import type { Item } from "../../types";
import { t } from "../../lib/i18n";

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
  const source = usePlayerSources((s) => (item ? s.sources[item.id] : undefined));
  const pushToast = useLibrary((s) => s.pushToast);

  // Assente = «usa il valore ricavato»: stagione 1, episodio visti+1. Scritto =
  // vince. Vedi PlayerSource.searchSeason.
  const fallback = item ? defaultPosition(item) : { season: 1, episode: 1 };
  const position = {
    season: source?.searchSeason ?? fallback.season,
    episode: source?.searchEpisode ?? fallback.episode,
  };
  const overridden = source?.searchSeason !== undefined || source?.searchEpisode !== undefined;

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
          {t("player_LinkHostPanel.lo_stream_di_test")}
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
    const result = await searchOnLinkHosts(item, enabled, controller.signal, position);
    if (controller.signal.aborted) return;
    setRetrying(false);
    setRetryOutcome(result);
    if (result.kind === "flusso") {
      // Scritto nella scheda del titolo invece che tenuto in memoria: un flusso
      // trovato una volta non ha motivo di essere ricercato al riavvio, e da lì
      // è la prima sorgente che il player guarda.
      patchSource(item.id, { manifestUrl: result.url });
      pushToast("success", t("player_LinkHostPanel.flusso_trovato_e_collegato"));
    }
  }

  return (
    <div className="pv-panel">
      <div className="pv-panel-header">
        <h3>{t("player_LinkHostPanel.siti")}</h3>
        <button type="button" className="pv-btn-secondary" onClick={() => openSettings()}>
          {t("player_LinkHostPanel.gestisci_in_impostazioni")}
        </button>
      </div>

      {enabled.length === 0 ? (
        <p className="pv-empty">
          {t("player_LinkHostPanel.nessun_link_host_attivo")}
        </p>
      ) : (
        <>
          <p className="pv-dim" style={{ fontSize: "0.8rem", lineHeight: 1.5 }}>
            {t("player_LinkHostPanel.la_domanda_per")}{item.title}»:{" "}
            <span className="pv-mono">{buildQuery(item, enabled[0].recipe, position)}</span>
          </p>

          {/*
            La libreria conta gli episodi come un totale unico, non per
            stagione: da «visti: 27» non si ricava se sia S02E03 o S03E01, e
            indovinare quale episodio stai per guardare è il tipo di errore che
            ti fa partire quello sbagliato. Quindi il valore predefinito è
            l'unico onesto — S01E{visti+1} — e queste due caselle sono il modo
            di correggerlo. Senza, i percorsi annidati per stagione non
            avrebbero mai un numero da mettere dentro.
          */}
          {item.kind !== "film" && (
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
              <label className="pv-field" style={{ padding: 0, maxWidth: 110 }}>
                <span>{t("player_LinkHostPanel.stagione")}</span>
                <input
                  type="number"
                  min={1}
                  value={position.season}
                  onChange={(e) =>
                    patchSource(item.id, { searchSeason: Math.max(1, Number(e.target.value) || 1) })
                  }
                />
              </label>
              <label className="pv-field" style={{ padding: 0, maxWidth: 110 }}>
                <span>{t("player_LinkHostPanel.episodio")}</span>
                <input
                  type="number"
                  min={1}
                  value={position.episode}
                  onChange={(e) =>
                    patchSource(item.id, { searchEpisode: Math.max(1, Number(e.target.value) || 1) })
                  }
                />
              </label>
              {overridden && (
                <button
                  type="button"
                  className="pv-btn-tiny"
                  onClick={() =>
                    patchSource(item.id, { searchSeason: undefined, searchEpisode: undefined })
                  }
                >
                  {t("player_LinkHostPanel.torna_a_s")}{String(fallback.season).padStart(2, "0")}E
                  {String(fallback.episode).padStart(2, "0")}
                </button>
              )}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {enabled.map((host) => {
              const urls = searchUrlsFor({ ...host, url: effectiveUrl(host) }, item, position);
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
                    <span className="pv-mono pv-dim" style={{ wordBreak: "break-all", fontSize: "0.75rem" }}>
                      {urls[0]}
                      {urls.length > 1 && (
                        <span className="pv-dim" style={{ fontFamily: "inherit" }}>
                          {" "}
                          {t("player_LinkHostPanel.e_altri")} {urls.length - 1} {t("player_LinkHostPanel.percorsi")}
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
                        {t("player_LinkHostPanel.apri_la_ricerca_nel")}
                      </button>
                    )}
                    <button
                      type="button"
                      className="pv-btn-tiny"
                      onClick={() =>
                        openViewer(effectiveUrl(host), { itemId: item.id, title: item.title })
                      }
                    >
                      {t("player_LinkHostPanel.apri_il_sito")}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button type="button" onClick={retry} disabled={retrying || busy}>
              {retrying || busy ? t("player_LinkHostPanel.cerco") : t("player_LinkHostPanel.cerca_di_nuovo")}
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
                {t("player_LinkHostPanel.altre_pagine_che_somigliano")}
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
        {t("player_LinkHostPanel.i_siti_si_interrogano")}
      </p>
    </div>
  );
}
