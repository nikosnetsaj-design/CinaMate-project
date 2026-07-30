import { useState, useEffect, useCallback, useRef } from 'react';
import type { DownloadItem, DownloadQuality, MediaContent } from '../types';
import * as downloadService from '../services/downloadService';

export function useDownloadManager() {
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [storage, setStorage] = useState({ usage: 0, quota: 0 });
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
    await downloadService.startDownload(content, quality);
    await refresh();
  }, [refresh]);

  const downloadSeason = useCallback(async (episodes: MediaContent[], quality: DownloadQuality) => {
    for (const ep of episodes) await downloadService.startDownload(ep, quality);
    await refresh();
  }, [refresh]);

  const pause = useCallback(async (id: string) => {
    await downloadService.pauseDownload(id);
    await refresh();
  }, [refresh]);

  const resume = useCallback(async (content: MediaContent, quality: DownloadQuality) => {
    await downloadService.resumeDownload(content, quality);
    await refresh();
  }, [refresh]);

  const remove = useCallback(async (id: string) => {
    subscribedIds.current.delete(id);
    unsubscribers.current.get(id)?.();
    unsubscribers.current.delete(id);
    await downloadService.deleteDownload(id);
    await refresh();
  }, [refresh]);

  return { downloads, storage, download, downloadSeason, pause, resume, remove, refresh };
}
