import { useNavigate } from "react-router-dom";
import { usePlayerSources, EMPTY_SOURCE } from "../store/usePlayerSources";
import { useSettingsSheet } from "../store/useSettingsSheet";
import { useSourceAddresses } from "../player/sourceAddresses";
import { hasAnySource } from "../player/resolveSource";
import { PlayIcon } from "./icons";
import type { Item } from "../types";
import { prefetchHandlers } from "../lib/prefetch";

/**
 * Starts a title in the player, from wherever you happen to be looking at it —
 * including a title you have just found by searching.
 *
 * It is always here. It used to hide itself whenever the title had no address,
 * which is right in principle and useless in practice: the first time you look
 * for it is the time nothing is configured yet, so the button was missing
 * exactly when you were looking for it and the feature read as absent. Now the
 * unconfigured case leads to the one screen that fixes it.
 */
export function WatchButton({ item, onNavigate }: { item: Item; onNavigate?: () => void }) {
  const navigate = useNavigate();
  const addresses = useSourceAddresses();
  const sources = usePlayerSources((s) => s.sources);
  const openSettings = useSettingsSheet((s) => s.open);

  const playable = hasAnySource(item, (id) => sources[id] ?? EMPTY_SOURCE, addresses);

  if (!playable) {
    return (
      <button
        type="button"
        onClick={() => {
          onNavigate?.();
          openSettings();
        }}
        className="mt-4 flex w-full flex-col items-center gap-0.5 rounded-md border border-dashed border-border-strong py-3 text-sm font-semibold text-text-muted"
      >
        <span className="flex items-center gap-2">
          <PlayIcon size={17} />
          Guarda
        </span>
        <span className="text-xs font-normal text-text-faint">
          Dimmi una volta sola dov'è il tuo server
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      // The player chunk is the biggest in the app, and this is the button most
      // likely to ask for it: starting the download when the pointer arrives
      // usually means it is already there when the tap lands.
      {...prefetchHandlers("/player")}
      onClick={() => {
        onNavigate?.();
        // The player reads this and starts on the title straight away.
        navigate(`/player?titolo=${encodeURIComponent(item.id)}`);
      }}
      className="mt-4 flex w-full items-center justify-center gap-2 rounded-md py-3 text-sm font-semibold transition-opacity hover:opacity-90"
      style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
    >
      <PlayIcon size={17} />
      Guarda
    </button>
  );
}
