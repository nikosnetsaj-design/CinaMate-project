import { useNavigate } from "react-router-dom";
import { usePlayerPrefs } from "../store/usePlayerPrefs";
import { usePlayerSources, EMPTY_SOURCE } from "../store/usePlayerSources";
import { hasAnySource } from "../player/resolveSource";
import { PlayIcon } from "./icons";
import type { Item } from "../types";

/**
 * Starts a title in the player, from wherever you happen to be looking at it.
 *
 * Only appears when the title actually has somewhere to play from — its own
 * address, an `.m3u8` personal link, or one of the patterns from Settings. A
 * button that leads to "there is nothing here" is worse than no button.
 */
export function WatchButton({ item, onNavigate }: { item: Item; onNavigate?: () => void }) {
  const navigate = useNavigate();
  const templates = usePlayerPrefs((s) => s.sourceTemplates);
  const sources = usePlayerSources((s) => s.sources);

  const playable = hasAnySource(item, (id) => sources[id] ?? EMPTY_SOURCE, templates);
  if (!playable) return null;

  return (
    <button
      type="button"
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
