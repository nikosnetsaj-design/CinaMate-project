import { useEffect, useRef, useState } from 'react';
import type { SkipMarker, MediaContent } from '../types';
import { markWatched, setWatchStatus } from '../services/statsAndHistory';

export const AUTOPLAY_COUNTDOWN_SEC = 8;
const COMPLETED_THRESHOLD = 0.92; // 92% watched counts as completed

type Props = {
  content: MediaContent | null;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  onPlayNext: () => void;
};

export function usePlaybackExtras({ content, currentTime, duration, isPlaying, onPlayNext }: Props) {
  const [activeMarker, setActiveMarker] = useState<SkipMarker | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [nextCancelled, setNextCancelled] = useState(false);
  const markedRef = useRef(false);

  // reset per-content state
  useEffect(() => {
    markedRef.current = false;
    setNextCancelled(false);
    setCountdown(null);
  }, [content?.id]);

  // active Skip Intro / Skip Recap / Skip Credits marker
  useEffect(() => {
    if (!content) {
      setActiveMarker(null);
      return;
    }
    const marker = content.skipMarkers.find(m => currentTime >= m.startSec && currentTime < m.endSec);
    setActiveMarker(marker ?? null);
  }, [content, currentTime]);

  // mark watched near the end + drive the "next up" countdown
  useEffect(() => {
    if (!content || !duration) return;
    const progress = currentTime / duration;

    if (progress >= COMPLETED_THRESHOLD && !markedRef.current) {
      markedRef.current = true;
      markWatched(content.id);
      setWatchStatus(content.id, 'completed');
    }

    const hasNext = !!(content.nextEpisode || content.nextInSaga);
    const timeRemaining = duration - currentTime;

    if (hasNext && isPlaying && !nextCancelled && timeRemaining <= AUTOPLAY_COUNTDOWN_SEC) {
      setCountdown(Math.max(0, Math.ceil(timeRemaining)));
    } else if (countdown !== null && (timeRemaining > AUTOPLAY_COUNTDOWN_SEC || nextCancelled)) {
      setCountdown(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTime, duration, content, isPlaying, nextCancelled]);

  useEffect(() => {
    if (countdown === 0) onPlayNext();
  }, [countdown, onPlayNext]);

  const cancelAutoplay = () => {
    setNextCancelled(true);
    setCountdown(null);
  };

  return { activeMarker, countdown, cancelAutoplay };
}
