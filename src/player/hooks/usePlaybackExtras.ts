import { useEffect, useRef, useState } from 'react';
import type { SkipMarker, MediaContent } from '../types';
import { markWatched, setWatchStatus } from '../services/statsAndHistory';
import { getPlaybackPrefs } from '../services/playbackPrefs';

export const AUTOPLAY_COUNTDOWN_SEC = 8;
const COMPLETED_THRESHOLD = 0.92; // 92% watched counts as completed

type Props = {
  content: MediaContent | null;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  onPlayNext: () => void;
  /** Jumps the playhead — how an automatic skip actually gets performed. */
  seek?: (sec: number) => void;
  /**
   * Set by the sleep timer's "fine episodio": the countdown must not run, and
   * the evening must not continue by itself.
   */
  blockAutoplay?: boolean;
  /**
   * Fired once per title, when enough of it has been watched to count as
   * finished. Lets the host app record the viewing in its own records — the
   * player's history is its own and says nothing to the rest of the app.
   */
  onCompleted?: (contentId: string) => void;
};

export function usePlaybackExtras({ content, currentTime, duration, isPlaying, onPlayNext, onCompleted, seek, blockAutoplay }: Props) {
  const [activeMarker, setActiveMarker] = useState<SkipMarker | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [nextCancelled, setNextCancelled] = useState(false);
  const [autoSkipped, setAutoSkipped] = useState<SkipMarker['type'] | null>(null);
  const markedRef = useRef(false);
  const skippedRef = useRef<Set<string>>(new Set());
  const seekRef = useRef(seek);
  seekRef.current = seek;

  // reset per-content state
  useEffect(() => {
    markedRef.current = false;
    skippedRef.current = new Set();
    setNextCancelled(false);
    setCountdown(null);
    setAutoSkipped(null);
  }, [content?.id]);

  // active Skip Intro / Skip Recap / Skip Credits marker
  useEffect(() => {
    if (!content) {
      setActiveMarker(null);
      return;
    }
    const marker = content.skipMarkers.find(m => currentTime >= m.startSec && currentTime < m.endSec);
    setActiveMarker(marker ?? null);

    // Automatic skipping, when asked for. Each marker is jumped at most once
    // per title: without that, seeking back into an intro you deliberately
    // wanted to rewatch would be undone instantly, forever — the player
    // fighting the person using it.
    if (!marker || !seekRef.current) return;
    const prefs = getPlaybackPrefs();
    const wanted = prefs.autoSkip === 'all' || (prefs.autoSkip === 'intro' && marker.type !== 'credits');
    const key = `${marker.type}:${marker.startSec}`;
    if (!wanted || skippedRef.current.has(key)) return;
    skippedRef.current.add(key);
    seekRef.current(marker.endSec);
    setAutoSkipped(marker.type);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, currentTime]);

  // The "saltato" note is a receipt, not a state: it says what just happened
  // and then gets out of the way.
  useEffect(() => {
    if (!autoSkipped) return;
    const id = window.setTimeout(() => setAutoSkipped(null), 2600);
    return () => window.clearTimeout(id);
  }, [autoSkipped]);

  // mark watched near the end + drive the "next up" countdown
  useEffect(() => {
    if (!content || !duration) return;
    const progress = currentTime / duration;

    if (progress >= COMPLETED_THRESHOLD && !markedRef.current) {
      markedRef.current = true;
      markWatched(content.id);
      setWatchStatus(content.id, 'completed');
      onCompleted?.(content.id);
    }

    const hasNext =
      !!(content.nextEpisode || content.nextInSaga) && getPlaybackPrefs().autoplayNext && !blockAutoplay;
    const timeRemaining = duration - currentTime;

    if (hasNext && isPlaying && !nextCancelled && timeRemaining <= AUTOPLAY_COUNTDOWN_SEC) {
      setCountdown(Math.max(0, Math.ceil(timeRemaining)));
    } else if (countdown !== null && (timeRemaining > AUTOPLAY_COUNTDOWN_SEC || nextCancelled)) {
      setCountdown(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTime, duration, content, isPlaying, nextCancelled, blockAutoplay]);

  useEffect(() => {
    if (countdown === 0) onPlayNext();
  }, [countdown, onPlayNext]);

  const cancelAutoplay = () => {
    setNextCancelled(true);
    setCountdown(null);
  };

  return { activeMarker, countdown, cancelAutoplay, autoSkipped };
}
