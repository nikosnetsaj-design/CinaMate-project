import { useState, useEffect, useCallback, useRef } from 'react';
import type { DownloadItem, DownloadQuality, MediaContent } from '../types';
import * as downloadService from '../services/downloadService';
import { UnsupportedPlaylistError } from '../services/hlsManifest';

// Starting a download reads the title's playlist, which can fail for reasons
// the user can act on — so it's reported, not swallowed into a rejected promise
// nobody is listening to.
function describeFailure(error: unknown): string {
  if (error instanceof UnsupportedPlaylistError) {
    if (error.reason === 'encrypted')
      return 'Questa sorgente è cifrata (EXT-X-KEY): il download offline non la supporta.';
    if (error.reason === 'byteranges')
      return 'Questa sorgente usa EXT-X-BYTERANGE: il download offline non la supporta.';
    return 'La playlist di questa sorgente non elenca segmenti scaricabili.';
  }
  return 'Non riesco a leggere la playlist di questa sorgente. Controlla l’indirizzo e i permessi CORS dell’host.';
}

export function useDownloadManager() {
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [storage, setStorage] = useState({ usage: 0, quota: 0 });
  const [error, setError] = useState<string | null>(null);
  const subscribedIds = useRef(new Set<string>());
  const unsubscribers = useRef(new Map<string, () => void>());

  const refresh = useCallback(async () => {
    const [items, storageEstimate] = await Promise.all([
      downloadService.listDownloads(),
      downloadService.getStorageEstimate(),
    ]);
    setDownloads(items);
    setStorage(storageEstimate);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Keep a live progress subscription for every download currently known.
  useEffect(() => {
    downloads.forEach(d => {
      if (subscribedIds.current.has(d.id)) return;
      subscribedIds.current.add(d.id);
      const unsub = downloadService.onDownloadProgress(d.id, updated => {
        setDownloads(prev => prev.map(p => (p.id === updated.id ? updated : p)));
        downloadService.getStorageEstimate().then(setStorage);
      });
      unsubscribers.current.set(d.id, unsub);
    });
    return () => {
      // cleanup happens on unmount only, subscriptions persist across renders
    };
  }, [downloads]);

  useEffect(
    () => () => {
      unsubscribers.current.forEach(unsub => unsub());
    },
    []
  );

  const download = useCallback(async (content: MediaContent, quality: DownloadQuality) => {
    setError(null);
    try {
      await downloadService.startDownload(content, quality);
    } catch (e) {
      setError(describeFailure(e));
    }
    await refresh();
  }, [refresh]);

  const downloadSeason = useCallback(async (episodes: MediaContent[], quality: DownloadQuality) => {
    setError(null);
    // One unreadable title doesn't cancel the rest of the queue.
    const failures: string[] = [];
    for (const ep of episodes) {
      try {
        await downloadService.startDownload(ep, quality);
      } catch (e) {
        failures.push(`${ep.title}: ${describeFailure(e)}`);
      }
    }
    if (failures.length) setError(failures.join(' · '));
    await refresh();
  }, [refresh]);

  const pause = useCallback(async (id: string) => {
    await downloadService.pauseDownload(id);
    await refresh();
  }, [refresh]);

  const resume = useCallback(async (content: MediaContent, quality: DownloadQuality) => {
    setError(null);
    try {
      await downloadService.resumeDownload(content, quality);
    } catch (e) {
      setError(describeFailure(e));
    }
    await refresh();
  }, [refresh]);

  const offlineSource = useCallback(
    (id: string) => downloadService.getOfflineSourceUrl(id),
    [],
  );

  const remove = useCallback(async (id: string) => {
    subscribedIds.current.delete(id);
    unsubscribers.current.get(id)?.();
    unsubscribers.current.delete(id);
    await downloadService.deleteDownload(id);
    await refresh();
  }, [refresh]);

  return {
    downloads, storage, error, download, downloadSeason,
    pause, resume, remove, refresh, offlineSource,
  };
}
