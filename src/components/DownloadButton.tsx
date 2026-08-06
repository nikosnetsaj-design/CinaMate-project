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
        pushToast("error", `Non trovo una sorgente per «${item.title}»: controlla gli indirizzi in Impostazioni.`);
        return;
      }
      const [content] = buildPlayerCatalog([item], lookup, null, addresses);
      if (!content) {
        pushToast("error", "Questo titolo non ha una sorgente da scaricare.");
        return;
      }
      await startDownload({ ...content, manifestUrl: resolved.source.url }, quality);
      pushToast("success", `«${item.title}» in scaricamento. L'avanzamento è nel player, pannello Download.`);
    } catch {
      // Il messaggio del servizio non è leggibile (è un errore di rete o di
      // playlist): quello che conta è che il download non è partito e dove
      // andare a vedere.
      pushToast("error", "Il download non è partito. La sorgente potrebbe non permettere le richieste da questa pagina.");
    } finally {
      setBusy(false);
    }
  }

  if (!playable) {
    return (
      <button
        type="button"
        onClick={() => openSettings()}
        className="mt-2.5 w-full rounded-md border border-dashed border-border-strong py-2.5 text-sm font-medium text-text-muted"
      >
        ↓ Scarica — prima dimmi dov'è il tuo server
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
        className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-md border border-border-strong bg-surface-hover py-2.5 text-sm font-semibold text-text disabled:opacity-60"
      >
        ↓ {busy ? "Preparo il download…" : "Scarica"}
      </button>

      {picking && (
        <div className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-md border border-border-strong bg-surface shadow-[var(--shadow-md)]">
          {QUALITIES.map((q) => (
            <button
              key={q.id}
              type="button"
              onClick={() => void download(q.id)}
              className="block w-full border-b border-border px-3.5 py-2.5 text-left text-sm text-text last:border-b-0 hover:bg-surface-hover"
            >
              {q.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
