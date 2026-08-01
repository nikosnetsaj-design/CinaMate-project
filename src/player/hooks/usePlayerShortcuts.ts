import { useCallback } from 'react';
import type { KeyboardEvent } from 'react';

type Actions = {
  togglePlay: () => void;
  seekBy: (deltaSec: number) => void;
  /** Jumps to a fraction of the whole, for the number keys. */
  seekToFraction: (fraction: number) => void;
  nudgeVolume: (delta: number) => void;
  nudgeRate: (delta: number) => void;
  toggleMute: () => void;
  toggleFullscreen: () => void;
  toggleSubtitles: () => void;
  togglePiP: () => void;
  toggleHelp: () => void;
  playNext?: (() => void) | null;
};

const SEEK_STEP_SEC = 10;
const VOLUME_STEP = 0.1;
const RATE_STEP = 0.25;

// A keystroke aimed at a text field is never a player shortcut — otherwise
// typing a subtitle URL with an "f" in it would throw the page into fullscreen.
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

/** What the help overlay lists — declared here so it can never drift from the bindings. */
export const SHORTCUTS: { keys: string; label: string }[] = [
  { keys: 'Spazio · K', label: 'Play / pausa' },
  { keys: '← →', label: 'Indietro / avanti di 10s' },
  { keys: 'J · L', label: 'Indietro / avanti di 10s' },
  { keys: '↑ ↓', label: 'Volume' },
  { keys: '0 – 9', label: 'Salta al 0%…90% del titolo' },
  { keys: 'M', label: 'Muto' },
  { keys: 'F', label: 'Schermo intero' },
  { keys: 'C', label: 'Cambia sottotitoli' },
  { keys: 'P', label: 'Picture in Picture' },
  { keys: '< >', label: 'Velocità di riproduzione' },
  { keys: 'N', label: 'Prossimo episodio' },
  { keys: '?', label: 'Questo elenco' },
];

/**
 * The keyboard controls every video player is expected to have. Bound to the
 * player shell rather than the document, so they only fire when the player
 * actually has focus and never fight the rest of the page for a keystroke.
 *
 * The set follows the convention people already know from YouTube and Netflix
 * (space/k, arrows, j/l, m, f, c, numbers) — a player that invents its own
 * bindings is worse than one with none.
 */
export function usePlayerShortcuts(actions: Actions) {
  return useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (isTypingTarget(event.target)) return;

      // The number row jumps through the title in tenths, exactly as everywhere
      // else — handled before the switch so all ten keys are one rule.
      if (event.key >= '0' && event.key <= '9') {
        event.preventDefault();
        actions.seekToFraction(Number(event.key) / 10);
        return;
      }

      switch (event.key) {
        case ' ':
        case 'k':
        case 'K':
          event.preventDefault(); // Space would otherwise scroll the page.
          actions.togglePlay();
          break;
        case 'ArrowRight':
        case 'l':
        case 'L':
          event.preventDefault();
          actions.seekBy(SEEK_STEP_SEC);
          break;
        case 'ArrowLeft':
        case 'j':
        case 'J':
          event.preventDefault();
          actions.seekBy(-SEEK_STEP_SEC);
          break;
        case 'ArrowUp':
          event.preventDefault();
          actions.nudgeVolume(VOLUME_STEP);
          break;
        case 'ArrowDown':
          event.preventDefault();
          actions.nudgeVolume(-VOLUME_STEP);
          break;
        case 'm':
        case 'M':
          actions.toggleMute();
          break;
        case 'f':
        case 'F':
          actions.toggleFullscreen();
          break;
        case 'c':
        case 'C':
          actions.toggleSubtitles();
          break;
        case 'p':
        case 'P':
          actions.togglePiP();
          break;
        case '>':
        case '.':
          actions.nudgeRate(RATE_STEP);
          break;
        case '<':
        case ',':
          actions.nudgeRate(-RATE_STEP);
          break;
        case 'n':
        case 'N':
          actions.playNext?.();
          break;
        case '?':
          event.preventDefault();
          actions.toggleHelp();
          break;
        default:
          break;
      }
    },
    [actions],
  );
}
