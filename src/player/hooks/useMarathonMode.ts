import { useMemo, useState, useCallback, useEffect } from 'react';
import type { EpisodeRef, SagaEntry } from '../types';
import { saveMarathonState, getMarathonState, markMarathonCompleted } from '../services/statsAndHistory';

type PlaylistItem = EpisodeRef | SagaEntry;

export function useMarathonMode(playlist: PlaylistItem[], playlistId: string) {
  const [index, setIndex] = useState(() => getMarathonState(playlistId) ?? 0);

  useEffect(() => {
    const saved = getMarathonState(playlistId);
    setIndex(saved ?? 0);
  }, [playlistId]);

  useEffect(() => {
    saveMarathonState(playlistId, index);
  }, [playlistId, index]);

  const totalDuration = useMemo(() => playlist.reduce((s, i) => s + i.durationSec, 0), [playlist]);
  const watchedDuration = useMemo(
    () => playlist.slice(0, index).reduce((s, i) => s + i.durationSec, 0),
    [playlist, index]
  );

  const completionPercent = totalDuration ? Math.min(100, (watchedDuration / totalDuration) * 100) : 0;
  const remainingSec = Math.max(0, totalDuration - watchedDuration);
  const current = playlist[index] ?? null;
  const hasNext = index < playlist.length - 1;

  const next = useCallback(() => {
    setIndex(i => {
      const nextIndex = Math.min(i + 1, playlist.length - 1);
      if (nextIndex === playlist.length - 1 && i !== nextIndex) markMarathonCompleted();
      return nextIndex;
    });
  }, [playlist.length]);

  const jumpTo = useCallback(
    (i: number) => setIndex(Math.max(0, Math.min(i, playlist.length - 1))),
    [playlist.length]
  );

  return { current, index, hasNext, next, jumpTo, completionPercent, remainingSec, totalDuration };
}
