import { useState } from "react";
import { useLibrary } from "../store/useLibrary";
import { usePlayerSources, EMPTY_SOURCE } from "../store/usePlayerSources";
import { useLinkHosts } from "../store/useLinkHosts";
import { useSettingsSheet } from "../store/useSettingsSheet";
import { useSourceAddresses } from "../player/sourceAddresses";
import { buildPlayerCatalog } from "../player/fromLibrary";
import { resolvePlayable, hasAnySource } from "../player/resolveSource";
import { startDownload } from "../player/services/downloadService";
import type { DownloadQuality } from "../player/types";
import type { Item } from "../types";
import { DownloadIcon } from "./icons";
import { t } from "../lib/i18n";

/**
 * «Scarica» dalla scheda del titolo, senza passare dal player.
 *
 * I download esistevano già, ma solo dentro la pagina Player, dietro un
 * pannello: cioè nel posto dove arrivi quando hai *già* deciso di guardare
 * adesso. Scaricare è l'altra decisione — "non adesso, ma stasera in treno" —
 * e si prende guardando la scheda.
 *
 * La differenza tecnica rispetto a Guarda è che qui l'indirizzo va risolto
 * prima: il player può permettersi di provarne venti mentre mostra uno
 * spinner, un download che parte da un indirizzo indovinato fallirebbe a metà
 * senza dire perché.
 */

const QUALITIES: { id: DownloadQuality; label: string }[] = [
  { id: "sd", label: "SD" },
  { id: "hd", label: "HD" },
  { id: "fullhd", label: "Full HD" },
  { id: "4k", label: "4K" },
];

export function DownloadButton({ item }: { item: Item }) {
  const addresses = useSourceAddresses();
  const sources = usePlayerSources((s) => s.sources);
  const linkHosts = useLinkHosts((s) => s.hosts);
  const pushToast = useLibrary((s) => s.pushToast);
  const openSettings = useSettingsSheet((s) => s.open);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);

  const lookup = (id: string) => sources[id] ?? EMPTY_SOURCE;
  const playable = hasAnySource(item, lookup, addresses, linkHosts);

  async function download(quality: DownloadQuality) {
    setPicking(false);
    setBusy(true);
    try {
      const source = lookup(item.id);
      const resolved = await resolvePlayable(item, lookup, addresses, {
        linkHosts,
        position: { season: source.searchSeason, episode: source.searchEpisode },
      });
      if (!resolved.source) {
        pushToast("error", t("DownloadButton.non_trovo_una_sorgente", { v0: item.title }));
        return;
      }
      const [content] = buildPlayerCatalog([item], lookup, null, addresses);
      if (!content) {
        pushToast("error", t("DownloadButton.questo_titolo_non_ha"));
        return;
      }
      await startDownload({ ...content, manifestUrl: resolved.source.url }, quality);
      pushToast("success", t("DownloadButton.in_scaricamento_l_avanzamento", { v0: item.title }));
    } catch {
      // Il messaggio del servizio non è leggibile (è un errore di rete o di
      // playlist): quello che conta è che il download non è partito e dove
      // andare a vedere.
      pushToast("error", t("DownloadButton.il_download_non_e"));
    } finally {
      setBusy(false);
    }
  }

  if (!playable) {
    return (
      <button
        type="button"
        onClick={() => openSettings()}
        className="btn btn-secondary btn-sm mt-2.5 w-full font-medium text-text-muted"
      >
        <DownloadIcon />
        {t("DownloadButton.scarica_prima_dimmi_dov")}
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setPicking((v) => !v)}
        disabled={busy}
        aria-expanded={picking}
        className="btn btn-secondary mt-2.5 w-full disabled:opacity-60"
      >
        <DownloadIcon />
        {busy ? t("DownloadButton.preparo_il_download") : t("DownloadButton.scarica")}
      </button>

      {picking && (
        <div className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-md bg-surface shadow-[var(--shadow-md),0_0_0_1px_var(--separator)]">
          {QUALITIES.map((q) => (
            <button
              key={q.id}
              type="button"
              onClick={() => void download(q.id)}
              className="block min-h-11 w-full px-4 py-2.5 text-left text-sm text-text hover:bg-surface-hover [&+&]:shadow-[inset_0_1px_0_var(--separator)]"
            >
              {q.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
