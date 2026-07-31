import { useCallback, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Touch gestures, and one honest limitation up front.
//
// "Luminosità" here dims the *picture*, not the screen: a web page cannot
// touch the device backlight (there is no API for it on iOS or Android, by
// design — a page that could dim your screen could also hide itself). What
// this does instead is a CSS `brightness()` filter on the video element,
// which is what every browser-based player means by the same word. It is
// genuinely useful for the case it exists for — a film mastered too bright
// for a dark room — and it stops at the picture.
//
// Volume has its own platform caveat: iOS ignores `video.volume` entirely
// and reserves loudness for the hardware buttons. The gesture is therefore
// reported as unavailable there rather than silently doing nothing, and the
// right half of the picture falls back to brightness too.
// ---------------------------------------------------------------------------

export type GestureKind = 'seek' | 'volume' | 'brightness';

export type GestureFeedback = {
  kind: GestureKind;
  /** 0–1 for volume/brightness; seconds of delta for seek. */
  value: number;
  label: string;
};

export const BRIGHTNESS_MIN = 0.25;
export const BRIGHTNESS_MAX = 1.5;

/** Movement (px) before a drag commits to an axis, so a tap never scrubs. */
const AXIS_LOCK_PX = 12;
/** Full height of a vertical drag maps to the whole volume/brightness range. */
const VERTICAL_RANGE_PX = 220;
/** Full width of a horizontal drag maps to this much seeking. */
const SEEK_RANGE_SEC = 120;
/** Outer share of the width, per side, that listens for a double tap. */
const TAP_ZONE_RATIO = 0.3;
const DOUBLE_TAP_MS = 280;
const DOUBLE_TAP_SEEK_SEC = 10;

type Options = {
  getCurrentTime: () => number;
  getDuration: () => number;
  seek: (sec: number) => void;
  setVolume: (v: number) => void;
  togglePlay: () => void;
  /** Set false to leave the picture entirely alone (e.g. in the mini player). */
  enabled?: boolean;
};

function mmss(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * iOS Safari exposes `volume` as a read-only property: assigning to it is a
 * no-op and loudness is the hardware buttons' business. Detected by feature
 * rather than by user-agent string, which is both more honest and survives
 * the next time Apple changes the UA.
 *
 * The probe writes to the element, so its answer is cached for the session:
 * it is a platform trait that cannot change between one swipe and the next,
 * and re-running it per gesture would put an audible blip in the audio every
 * time a finger crossed the axis-lock threshold.
 */
let volumeSettable: boolean | null = null;

function volumeIsSettable(video: HTMLVideoElement | null): boolean {
  if (volumeSettable !== null) return volumeSettable;
  if (!video) return false; // undecided — try again on the next gesture
  const original = video.volume;
  const probe = original > 0.5 ? 0.4 : 0.6;
  video.volume = probe;
  volumeSettable = Math.abs(video.volume - probe) < 0.01;
  video.volume = original;
  return volumeSettable;
}

export function usePlayerGestures(videoRef: React.RefObject<HTMLVideoElement | null>, options: Options) {
  const { enabled = true } = options;

  const [brightness, setBrightness] = useState(1);
  const [feedback, setFeedback] = useState<GestureFeedback | null>(null);

  // Everything a live drag needs, kept in one ref so a move handler firing at
  // touch frequency never triggers a React render just to bookkeep itself.
  const dragRef = useRef({
    active: false,
    axis: null as GestureKind | null,
    startX: 0,
    startY: 0,
    startTime: 0,
    startVolume: 1,
    startBrightness: 1,
    /** Where the seek will land, applied on touchend rather than per-frame. */
    pendingSeek: null as number | null,
    /** True once the finger has travelled far enough to be a drag, not a tap. */
    moved: false,
  });

  const tapRef = useRef({ at: 0, side: '' as '' | 'left' | 'right', timer: 0 });
  const feedbackTimer = useRef(0);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const showFeedback = useCallback((next: GestureFeedback | null, holdMs = 700) => {
    setFeedback(next);
    window.clearTimeout(feedbackTimer.current);
    if (next) feedbackTimer.current = window.setTimeout(() => setFeedback(null), holdMs);
  }, []);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled || e.touches.length !== 1) return;
      const touch = e.touches[0];
      const video = videoRef.current;
      dragRef.current = {
        active: true,
        axis: null,
        startX: touch.clientX,
        startY: touch.clientY,
        startTime: optionsRef.current.getCurrentTime(),
        startVolume: video?.volume ?? 1,
        startBrightness: brightness,
        pendingSeek: null,
        moved: false,
      };
    },
    [enabled, brightness, videoRef]
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const drag = dragRef.current;
      if (!enabled || !drag.active || e.touches.length !== 1) return;

      const touch = e.touches[0];
      const dx = touch.clientX - drag.startX;
      const dy = touch.clientY - drag.startY;
      const rect = e.currentTarget.getBoundingClientRect();

      if (!drag.axis) {
        if (Math.abs(dx) < AXIS_LOCK_PX && Math.abs(dy) < AXIS_LOCK_PX) return;
        drag.moved = true;
        if (Math.abs(dx) > Math.abs(dy)) {
          drag.axis = 'seek';
        } else {
          // Right half is volume where volume is ours to set; on iOS it isn't,
          // so both halves adjust the picture instead of one half doing nothing.
          const onRightHalf = drag.startX - rect.left > rect.width / 2;
          drag.axis = onRightHalf && volumeIsSettable(videoRef.current) ? 'volume' : 'brightness';
        }
      }

      if (drag.axis === 'seek') {
        const duration = optionsRef.current.getDuration();
        if (!duration) return;
        const delta = (dx / rect.width) * SEEK_RANGE_SEC;
        const target = Math.max(0, Math.min(duration, drag.startTime + delta));
        drag.pendingSeek = target;
        const applied = target - drag.startTime;
        showFeedback(
          {
            kind: 'seek',
            value: applied,
            label: `${applied >= 0 ? '+' : '−'}${mmss(Math.abs(applied))} · ${mmss(target)}`,
          },
          2000
        );
        return;
      }

      // Upward drag increases, which is the direction every phone player uses.
      const step = -dy / VERTICAL_RANGE_PX;

      if (drag.axis === 'volume') {
        const next = Math.max(0, Math.min(1, drag.startVolume + step));
        optionsRef.current.setVolume(next);
        showFeedback({ kind: 'volume', value: next, label: `${Math.round(next * 100)}%` });
        return;
      }

      const span = BRIGHTNESS_MAX - BRIGHTNESS_MIN;
      const next = Math.max(BRIGHTNESS_MIN, Math.min(BRIGHTNESS_MAX, drag.startBrightness + step * span));
      setBrightness(next);
      showFeedback({ kind: 'brightness', value: next, label: `${Math.round(next * 100)}%` });
    },
    [enabled, showFeedback, videoRef]
  );

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const drag = dragRef.current;
      if (!enabled || !drag.active) return;
      drag.active = false;

      // A committed scrub is applied once, here: seeking on every touchmove
      // makes hls.js discard and refetch the buffer dozens of times for a
      // single swipe, which is exactly the stutter the gesture is meant to avoid.
      if (drag.axis === 'seek' && drag.pendingSeek !== null) {
        optionsRef.current.seek(drag.pendingSeek);
        showFeedback(null);
        return;
      }
      if (drag.moved) return; // a vertical drag has already done its work

      // --- Taps ---
      const rect = e.currentTarget.getBoundingClientRect();
      const x = drag.startX - rect.left;
      const zone = rect.width * TAP_ZONE_RATIO;
      const side: '' | 'left' | 'right' = x < zone ? 'left' : x > rect.width - zone ? 'right' : '';

      // The middle of the picture toggles playback with no delay at all. Only
      // the two outer strips wait to see whether a second tap is coming, so
      // the double-tap-to-skip gesture never taxes the common case.
      if (!side) {
        window.clearTimeout(tapRef.current.timer);
        tapRef.current = { at: 0, side: '', timer: 0 };
        optionsRef.current.togglePlay();
        return;
      }

      const now = Date.now();
      const isDouble = now - tapRef.current.at < DOUBLE_TAP_MS && tapRef.current.side === side;

      if (isDouble) {
        window.clearTimeout(tapRef.current.timer);
        tapRef.current = { at: 0, side: '', timer: 0 };
        const delta = side === 'left' ? -DOUBLE_TAP_SEEK_SEC : DOUBLE_TAP_SEEK_SEC;
        const duration = optionsRef.current.getDuration();
        const target = Math.max(0, Math.min(duration || Infinity, optionsRef.current.getCurrentTime() + delta));
        optionsRef.current.seek(target);
        showFeedback({ kind: 'seek', value: delta, label: `${delta > 0 ? '+' : '−'}${DOUBLE_TAP_SEEK_SEC}s` }, 600);
        return;
      }

      const timer = window.setTimeout(() => {
        tapRef.current = { at: 0, side: '', timer: 0 };
        optionsRef.current.togglePlay();
      }, DOUBLE_TAP_MS);
      tapRef.current = { at: now, side, timer };
    },
    [enabled, showFeedback]
  );

  const adjustBrightness = useCallback(
    (value: number) => {
      const next = Math.max(BRIGHTNESS_MIN, Math.min(BRIGHTNESS_MAX, value));
      setBrightness(next);
      showFeedback({ kind: 'brightness', value: next, label: `${Math.round(next * 100)}%` });
    },
    [showFeedback]
  );

  return {
    brightness,
    /** For the settings panel, so the gesture isn't the only way in. */
    adjustBrightness,
    feedback,
    /** Spread onto the element that owns the picture. */
    handlers: { onTouchStart, onTouchMove, onTouchEnd },
  };
}
