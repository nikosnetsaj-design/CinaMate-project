import type { DownloadItem, DownloadQuality, MediaContent } from '../types';
import { resolveDownloadPlan } from './hlsManifest';

// ---------------------------------------------------------------------------
// Offline download engine backed by IndexedDB.
//
// Design: each download is split into segments (matching the HLS rendition's
// .ts/.m4s segments) so we can pause/resume without re-downloading finished
// parts, and so very large files never need to sit fully in memory at once.
//
// The segment list is read from the title's own HLS playlist (see
// hlsManifest.ts). An `/api/content/:id/download-manifest` endpoint is still
// honoured when one answers, because a backend can give exact sizes and signed
// URLs; without one, the playlist is enough and no server is required.
//
// Only ever point this at content you have the right to store offline.
// ---------------------------------------------------------------------------

const DB_NAME = 'ppv-downloads';
const DB_VERSION = 2;
const SEGMENTS_STORE = 'segments';
const ITEMS_STORE = 'items';
// Per-download segment list and durations. Kept so a resume needs no network,
// a delete knows exactly how many keys to drop (rather than guessing), and
// offline playback can rebuild a playable playlist — see getOfflineSourceUrl.
const META_STORE = 'meta';

interface DownloadMeta {
  id: string;
  segments: string[];
  durations: number[];
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(SEGMENTS_STORE)) db.createObjectStore(SEGMENTS_STORE);
      if (!db.objectStoreNames.contains(ITEMS_STORE)) db.createObjectStore(ITEMS_STORE, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE, { keyPath: 'id' });
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
const putMeta = (meta: DownloadMeta) => idbRequest(META_STORE, 'readwrite', s => s.put(meta));
const getMeta = (id: string) => idbRequest<DownloadMeta | undefined>(META_STORE, 'readonly', s => s.get(id));
const deleteMeta = (id: string) => idbRequest(META_STORE, 'readwrite', s => s.delete(id));

async function deleteSegments(downloadId: string, count: number) {
  const db = await openDb();
  const t = db.transaction(SEGMENTS_STORE, 'readwrite');
  for (let i = 0; i < count; i++) t.objectStore(SEGMENTS_STORE).delete(`${downloadId}:${i}`);
  return new Promise<void>((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

/**
 * The segment list for a download. A backend endpoint is preferred when one
 * answers — it can report exact sizes and hand out signed URLs — and the
 * title's own HLS playlist is the fallback, which is what makes offline
 * download work with no server at all.
 */
async function fetchDownloadManifest(
  content: MediaContent,
  quality: DownloadQuality,
): Promise<{ segments: string[]; durations: number[]; totalBytes: number }> {
  try {
    const res = await fetch(`/api/content/${content.id}/download-manifest?quality=${quality}`);
    if (res.ok) {
      const body = (await res.json()) as { segments: string[]; totalBytes: number; durations?: number[] };
      if (Array.isArray(body.segments) && body.segments.length) {
        return { durations: body.durations ?? body.segments.map(() => 0), ...body };
      }
    }
  } catch {
    // No such endpoint (the normal case) — read the playlist instead.
  }
  return resolveDownloadPlan(content.manifestUrl, quality);
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
  const { segments, durations, totalBytes } = await fetchDownloadManifest(content, quality);
  await putMeta({ id, segments, durations });

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

  // Resume from the stored list: re-reading the playlist would need the network
  // back, which is exactly what a paused download usually lacks. Only a
  // download from before this list existed has to fetch it again.
  const stored = await getMeta(id);
  const { segments, durations } = stored ?? (await fetchDownloadManifest(content, quality));
  if (!stored) await putMeta({ id, segments, durations });

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
  // The stored list gives the exact count; the fallback only matters for a
  // download written before that list existed. Missing keys are safely ignored.
  const meta = await getMeta(id);
  await deleteSegments(id, meta?.segments.length ?? approxSegmentCount);
  await deleteMeta(id);
  await deleteItemRecord(id);
}

/**
 * A playable source for a completed download, as a blob `.m3u8` whose segment
 * URIs are blob URLs of the stored segments. hls.js then plays it exactly as it
 * plays a network stream, which is what makes the whole player — seeking,
 * quality badge, subtitles, skip markers — work offline unchanged.
 *
 * Why a playlist and not one concatenated blob: browsers cannot play raw
 * MPEG-TS from a `<video src>`, so the previous concat approach produced a file
 * nothing could open. Going through a playlist keeps hls.js's transmuxer in the
 * path, which is the piece that turns TS into something MSE accepts.
 *
 * Caller owns the returned URLs and must call `revokeOfflineSource` when done —
 * blob URLs are held until revoked or the document goes away.
 */
export interface OfflineSource {
  url: string;
  revoke: () => void;
}

export async function getOfflineSourceUrl(id: string): Promise<OfflineSource | null> {
  const meta = await getMeta(id);
  if (!meta || !meta.segments.length) return null;

  const urls: string[] = [];
  const entries: string[] = [];
  for (let i = 0; i < meta.segments.length; i++) {
    const blob = await getSegment(id, i);
    if (!blob) continue;
    const url = URL.createObjectURL(blob);
    urls.push(url);
    // A duration is required by EXTINF; 0 would make hls.js reject the
    // playlist, so a missing one falls back to the HLS default target.
    entries.push(`#EXTINF:${(meta.durations[i] || 6).toFixed(3)},`, url);
  }
  if (!urls.length) return null;

  const targetDuration = Math.ceil(Math.max(6, ...meta.durations.filter(Number.isFinite)));
  const playlist = [
    '#EXTM3U',
    '#EXT-X-VERSION:3',
    `#EXT-X-TARGETDURATION:${targetDuration}`,
    '#EXT-X-MEDIA-SEQUENCE:0',
    '#EXT-X-PLAYLIST-TYPE:VOD',
    ...entries,
    '#EXT-X-ENDLIST',
    '',
  ].join('\n');

  const playlistUrl = URL.createObjectURL(new Blob([playlist], { type: 'application/vnd.apple.mpegurl' }));
  return {
    url: playlistUrl,
    revoke: () => {
      URL.revokeObjectURL(playlistUrl);
      for (const url of urls) URL.revokeObjectURL(url);
    },
  };
}
