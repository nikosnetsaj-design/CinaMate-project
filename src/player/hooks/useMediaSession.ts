import { useEffect, useRef } from 'react';
import type { MediaContent } from '../types';

type Actions = {
  play: () => void;
  pause: () => void;
  seekTo: (sec: number) => void;
  seekBy: (delta: number) => void;
  next?: (() => void) | null;
};

/**
 * Publishes what is playing to the operating system.
 *
 * This is what puts the title, the poster and working play/pause controls on a
 * phone's lock screen, in the notification shade, on the media keys of a
 * keyboard and in the browser's own media panel. Without it a film watched on a
 * phone can only be paused by unlocking the device, finding the tab and hitting
 * a button — which is precisely the moment the screen is hardest to reach.
 *
 * Every part is behind a feature test: Media Session is well supported but its
 * individual actions are not, and setting an unsupported one throws rather than
 * being ignored.
 */
export function useMediaSession(content: MediaContent | null, isPlaying: boolean, duration: number, currentTime: number, actions: Actions) {
  const title = content?.title;
  const seriesTitle = content?.seriesTitle;
  const posterUrl = content?.posterUrl;

  // Metadata: cheap to set, and only when the title itself changes.
  useEffect(() => {
    if (!('mediaSession' in navigator) || !title) return;
    const artwork = posterUrl ? [{ src: posterUrl, sizes: '512x512', type: 'image/jpeg' }] : [];
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title,
        artist: seriesTitle || 'CineMate',
        album: seriesTitle || '',
        artwork,
      });
    } catch {
      // Some browsers expose mediaSession without the MediaMetadata
      // constructor; the controls still work, only unlabelled.
    }
  }, [title, seriesTitle, posterUrl]);

  // The caller passes a fresh object literal every render. Bound through a ref
  // so the OS handlers are registered once for the life of the player rather
  // than torn down and re-registered several times a second while playing —
  // which some browsers answer by dropping the lock screen controls entirely.
  const actionsRef = useRef(actions);
  actionsRef.current = actions;
  const hasNext = !!actions.next;

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const session = navigator.mediaSession;

    const handlers: [MediaSessionAction, MediaSessionActionHandler | null][] = [
      ['play', () => actionsRef.current.play()],
      ['pause', () => actionsRef.current.pause()],
      ['seekbackward', (d) => actionsRef.current.seekBy(-(d.seekOffset ?? 10))],
      ['seekforward', (d) => actionsRef.current.seekBy(d.seekOffset ?? 10)],
      ['seekto', (d) => { if (typeof d.seekTime === 'number') actionsRef.current.seekTo(d.seekTime); }],
      // Previous is bound to "back to the start of this one", the behaviour
      // every music player has trained people to expect from that button.
      ['previoustrack', () => actionsRef.current.seekTo(0)],
      // Registered only when there is somewhere to go: a dead "next" button on
      // the lock screen is worse than no button at all.
      ['nexttrack', hasNext ? () => actionsRef.current.next?.() : null],
    ];

    for (const [action, handler] of handlers) {
      try {
        session.setActionHandler(action, handler);
      } catch {
        // Unsupported action on this browser — skip it, keep the rest.
      }
    }

    return () => {
      for (const [action] of handlers) {
        try {
          session.setActionHandler(action, null);
        } catch {
          /* nothing bound */
        }
      }
    };
  }, [hasNext]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
  }, [isPlaying]);

  // The scrubber on the lock screen. Guarded because Chrome throws when the
  // position is past the duration, which happens for a moment on every switch
  // to a shorter title.
  useEffect(() => {
    if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState) return;
    if (!duration || !Number.isFinite(duration) || currentTime > duration) return;
    try {
      navigator.mediaSession.setPositionState({ duration, position: Math.max(0, currentTime), playbackRate: 1 });
    } catch {
      /* rejected — the lock screen simply shows no progress */
    }
  }, [duration, currentTime]);
}
