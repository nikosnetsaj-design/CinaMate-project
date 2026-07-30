import { useCallback } from 'react';
import type { KeyboardEvent } from 'react';

type Actions = {
  togglePlay: () => void;
  seekBy: (deltaSec: number) => void;
  nudgeVolume: (delta: number) => void;
  toggleMute: () => void;
  toggleFullscreen: () => void;
  toggleSubtitles: () => void;
};

const SEEK_STEP_SEC = 10;
const VOLUME_STEP = 0.1;

// A keystroke aimed at a text field is never a player shortcut — otherwise
// typing a subtitle URL with an "f" in it would throw the page into fullscreen.
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

/**
 * The keyboard controls every video player is expected to have. Bound to the
 * player shell rather than the document, so they only fire when the player
 * actually has focus and never fight the rest of the page for a keystroke.
 *
 * The set follows the convention people already know from YouTube and Netflix
 * (space/k, arrows, j/l, m, f, c) — a player that invents its own bindings is
 * worse than one with none.
 */
export function usePlayerShortcuts(actions: Actions) {
  return useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (isTypingTarget(event.target)) return;

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
        default:
          break;
      }
    },
    [actions],
  );
}
