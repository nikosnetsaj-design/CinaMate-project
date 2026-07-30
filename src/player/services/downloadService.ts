import type { DownloadItem, DownloadQuality, MediaContent } from '../types';

// ---------------------------------------------------------------------------
// Offline download engine backed by IndexedDB.
//
// Design: each download is split into segments (matching the HLS rendition's
// .ts/.m4s segments) so we can pause/resume without re-downloading finished
// parts, and so very large files never need to sit fully in memory at once.
//
// NOTE for production: `fetchDownloadManifest` below must point at your own
// backend/CDN. Never point this at a third-party streaming service you don't
// have distribution rights for.
// ---------------------------------------------------------------------------

const DB_NAME = 'ppv-downloads';
const DB_VERSION = 1;
const SEGMENTS_STORE = 'segments';
const ITEMS_STORE = 'items';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(SEGMENTS_STORE)) db.createObjectStore(SEGMENTS_STORE);
      if (!db.objectStoreNames.contains(ITEMS_STORE)) db.createObjectStore(ITEMS_STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbRequest<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const req = fn(t.objectStore(store));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const getAllItems = () => idbRequest<DownloadItem[]>(ITEMS_STORE, 'readonly', s => s.getAll());
const putItem = (item: DownloadItem) => idbRequest(ITEMS_STORE, 'readwrite', s => s.put(item));
const deleteItemRecord = (id: string) => idbRequest(ITEMS_STORE, 'readwrite', s => s.delete(id));
const putSegment = (downloadId: string, index: number, blob: Blob) =>
  idbRequest(SEGMENTS_STORE, 'readwrite', s => s.put(blob, `${downloadId}:${index}`));
const getSegment = (downloadId: string, index: number) =>
  idbRequest<Blob | undefined>(SEGMENTS_STORE, 'readonly', s => s.get(`${downloadId}:${index}`));

async function deleteSegments(downloadId: string, count: number) {
  const db = await openDb();
  const t = db.transaction(SEGMENTS_STORE, 'readwrite');
  for (let i = 0; i < count; i++) t.objectStore(SEGMENTS_STORE).delete(`${downloadId}:${i}`);
  return new Promise<void>((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

// Replace with a real call to your own API. It should return the list of
// segment URLs for the requested quality plus their combined size.
async function fetchDownloadManifest(content: MediaContent, quality: DownloadQuality) {
  const res = await fetch(`/api/content/${content.id}/download-manifest?quality=${quality}`);
  if (!res.ok) throw new Error('manifest_fetch_failed');
  return res.json() as Promise<{ segments: string[]; totalBytes: number }>;
}

const controllers = new Map<string, AbortController>();
const progressListeners = new Map<string, Set<(item: DownloadItem) => void>>();

function emitProgress(item: DownloadItem) {
  progressListeners.get(item.id)?.forEach(cb => cb(item));
}

export function onDownloadProgress(id: string, cb: (item: DownloadItem) => void) {
  if (!progressListeners.has(id)) progressListeners.set(id, new Set());
  progressListeners.get(id)!.add(cb);
  return () => progressListeners.get(id)?.delete(cb);
}

export async function listDownloads(): Promise<DownloadItem[]> {
  return getAllItems();
}

export async function getStorageEstimate(): Promise<{ usage: number; quota: number }> {
  if (!navigator.storage?.estimate) return { usage: 0, quota: 0 };
  const { usage = 0, quota = 0 } = await navigator.storage.estimate();
  return { usage, quota };
}

async function runDownloadLoop(id: string, segments: string[], startIndex: number, itemSeed: DownloadItem, signal: AbortSignal) {
  let item = itemSeed;
  const approxSegBytes = item.totalBytes / segments.length;
  for (let i = startIndex; i < segments.length; i++) {
    if (signal.aborted) return;
    const res = await fetch(segments[i], { signal });
    if (!res.ok) throw new Error(`segment_${i}_failed`);
    const blob = await res.blob();
    await putSegment(id, i, blob);
    item = { ...item, downloadedBytes: Math.min(item.totalBytes, Math.round((i + 1) * approxSegBytes)) };
    await putItem(item);
    emitProgress(item);
  }
  item = { ...item, status: 'completed', downloadedBytes: item.totalBytes };
  await putItem(item);
  emitProgress(item);
  controllers.delete(id);
}

export async function startDownload(content: MediaContent, quality: DownloadQuality): Promise<string> {
  const id = `${content.id}:${quality}`;
  const { segments, totalBytes } = await fetchDownloadManifest(content, quality);

  const item: DownloadItem = {
    id, contentId: content.id, title: content.title, posterUrl: content.posterUrl,
    quality, totalBytes, downloadedBytes: 0, status: 'downloading', createdAt: Date.now(),
  };
  await putItem(item);
  emitProgress(item);

  const controller = new AbortController();
  controllers.set(id, controller);

  runDownloadLoop(id, segments, 0, item, controller.signal).catch(async () => {
    const failed = { ...item, status: 'error' as const };
    await putItem(failed);
    emitProgress(failed);
  });

  return id;
}

export async function pauseDownload(id: string) {
  controllers.get(id)?.abort();
  controllers.delete(id);
  const items = await getAllItems();
  const item = items.find(i => i.id === id);
  if (item) {
    const paused = { ...item, status: 'paused' as const };
    await putItem(paused);
    emitProgress(paused);
  }
}

export async function resumeDownload(content: MediaContent, quality: DownloadQuality): Promise<string> {
  const id = `${content.id}:${quality}`;
  const items = await getAllItems();
  const existing = items.find(i => i.id === id);
  if (!existing) return startDownload(content, quality);

  const { segments } = await fetchDownloadManifest(content, quality);
  const approxSegBytes = existing.totalBytes / segments.length;
  const resumeIndex = Math.min(segments.length - 1, Math.floor(existing.downloadedBytes / approxSegBytes));

  const controller = new AbortController();
  controllers.set(id, controller);
  const resumedItem = { ...existing, status: 'downloading' as const };
  await putItem(resumedItem);
  emitProgress(resumedItem);

  runDownloadLoop(id, segments, resumeIndex, resumedItem, controller.signal).catch(async () => {
    const failed = { ...resumedItem, status: 'error' as const };
    await putItem(failed);
    emitProgress(failed);
  });
  return id;
}

export async function deleteDownload(id: string, approxSegmentCount = 2000) {
  controllers.get(id)?.abort();
  controllers.delete(id);
  await deleteSegments(id, approxSegmentCount); // missing keys are safely ignored
  await deleteItemRecord(id);
}

// Reassembles stored segments into a single playable Blob URL. Fine for
// episodes/movies at moderate size; very large 4K files should instead be fed
// segment-by-segment into a custom MediaSource SourceBuffer for offline
// playback — see README "Offline playback at scale".
export async function getPlayableUrl(id: string, segmentCount: number): Promise<string> {
  const parts: Blob[] = [];
  for (let i = 0; i < segmentCount; i++) {
    const seg = await getSegment(id, i);
    if (seg) parts.push(seg);
  }
  return URL.createObjectURL(new Blob(parts, { type: 'video/mp2t' }));
}
