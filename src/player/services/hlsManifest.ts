import type { DownloadQuality } from '../types';

// ---------------------------------------------------------------------------
// Minimal HLS playlist reader.
//
// It exists so offline download works against a plain manifest, with no API of
// your own behind it: the segment list a download needs is already written in
// the playlist, so there is no reason to ask a backend to repeat it.
//
// Deliberately partial — it handles what a VOD playlist normally contains
// (a master with variants, or a media playlist with EXTINF segments) and no
// more. Known gaps, which `resolveDownloadPlan` reports rather than silently
// mangling: EXT-X-KEY (encrypted segments, which would need the key and an
// AES-128 decrypt pass) and EXT-X-BYTERANGE (several segments packed into one
// file, addressed by range).
// ---------------------------------------------------------------------------

export interface Variant {
  url: string;
  height: number;
  bandwidth: number;
}

export interface MediaPlaylist {
  segments: string[];
  durations: number[];
  encrypted: boolean;
  byteRanged: boolean;
}

export interface DownloadPlan {
  segments: string[];
  durations: number[];
  totalBytes: number;
  totalDurationSec: number;
}

export type UnsupportedReason = 'encrypted' | 'byteranges' | 'empty';

export class UnsupportedPlaylistError extends Error {
  // Assigned explicitly rather than as a constructor parameter property:
  // tsconfig.app.json sets `erasableSyntaxOnly`, which rules those out.
  readonly reason: UnsupportedReason;

  constructor(reason: UnsupportedReason) {
    super(reason);
    this.name = 'UnsupportedPlaylistError';
    this.reason = reason;
  }
}

const TARGET_HEIGHT: Record<DownloadQuality, number> = {
  sd: 480,
  hd: 720,
  fullhd: 1080,
  '4k': 2160,
};

function lines(text: string): string[] {
  return text.split('\n').map(l => l.trim()).filter(Boolean);
}

export function isMasterPlaylist(text: string): boolean {
  return text.includes('#EXT-X-STREAM-INF');
}

export function parseMaster(text: string, baseUrl: string): Variant[] {
  const rows = lines(text);
  const variants: Variant[] = [];
  for (let i = 0; i < rows.length; i++) {
    if (!rows[i].startsWith('#EXT-X-STREAM-INF')) continue;
    const attrs = rows[i].slice(rows[i].indexOf(':') + 1);
    const uri = rows[i + 1];
    if (!uri || uri.startsWith('#')) continue;
    variants.push({
      url: new URL(uri, baseUrl).toString(),
      height: Number(/RESOLUTION=\d+x(\d+)/.exec(attrs)?.[1] ?? 0),
      bandwidth: Number(/BANDWIDTH=(\d+)/.exec(attrs)?.[1] ?? 0),
    });
  }
  return variants;
}

export function parseMedia(text: string, baseUrl: string): MediaPlaylist {
  const rows = lines(text);
  const segments: string[] = [];
  const durations: number[] = [];
  let pending = 0;
  for (const row of rows) {
    if (row.startsWith('#EXTINF:')) {
      pending = parseFloat(row.slice('#EXTINF:'.length)) || 0;
    } else if (!row.startsWith('#')) {
      segments.push(new URL(row, baseUrl).toString());
      durations.push(pending);
      pending = 0;
    }
  }
  return {
    segments,
    durations,
    // METHOD=NONE is a valid way of saying "this part isn't encrypted".
    encrypted: rows.some(r => r.startsWith('#EXT-X-KEY') && !/METHOD=NONE/.test(r)),
    byteRanged: rows.some(r => r.startsWith('#EXT-X-BYTERANGE')),
  };
}

/**
 * Picks the variant closest to the requested quality without going over, so
 * asking for 4K on a source that only has 1080p downloads the 1080p rather
 * than failing. Falls back to the smallest variant when every one is larger.
 */
export function pickVariant(variants: Variant[], quality: DownloadQuality): Variant | null {
  if (!variants.length) return null;
  const target = TARGET_HEIGHT[quality];
  const byHeight = [...variants].sort((a, b) => a.height - b.height);
  const atOrBelow = byHeight.filter(v => v.height > 0 && v.height <= target);
  if (atOrBelow.length) return atOrBelow[atOrBelow.length - 1];
  // No usable RESOLUTION attributes: fall back to bandwidth ordering, which
  // every variant is required to declare.
  const withoutHeight = byHeight.filter(v => v.height === 0);
  if (withoutHeight.length === byHeight.length) {
    return [...variants].sort((a, b) => a.bandwidth - b.bandwidth)[0];
  }
  return byHeight[0];
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`playlist_fetch_failed_${res.status}`);
  return res.text();
}

/**
 * Everything needed to download a title offline, read straight from its own
 * manifest. `totalBytes` is an estimate (declared bandwidth × duration): HLS
 * playlists don't carry segment sizes, so the alternative would be a HEAD
 * request per segment, which costs more than the progress bar's accuracy is
 * worth. Progress is reported against the same estimate, so the bar still
 * reaches 100% exactly when the last segment lands.
 */
export async function resolveDownloadPlan(
  manifestUrl: string,
  quality: DownloadQuality,
): Promise<DownloadPlan> {
  const text = await fetchText(manifestUrl);

  let mediaUrl = manifestUrl;
  let bandwidth = 0;
  if (isMasterPlaylist(text)) {
    const variant = pickVariant(parseMaster(text, manifestUrl), quality);
    if (!variant) throw new UnsupportedPlaylistError('empty');
    mediaUrl = variant.url;
    bandwidth = variant.bandwidth;
  }

  const media = mediaUrl === manifestUrl
    ? parseMedia(text, manifestUrl)
    : parseMedia(await fetchText(mediaUrl), mediaUrl);

  if (media.encrypted) throw new UnsupportedPlaylistError('encrypted');
  if (media.byteRanged) throw new UnsupportedPlaylistError('byteranges');
  if (!media.segments.length) throw new UnsupportedPlaylistError('empty');

  const totalDurationSec = media.durations.reduce((s, d) => s + d, 0);
  // Without a master playlist there's no declared bandwidth to estimate from;
  // 3 Mbps is a middling HD rate and only affects how the progress bar is
  // scaled, never what gets stored.
  const bitsPerSecond = bandwidth || 3_000_000;

  return {
    segments: media.segments,
    durations: media.durations,
    totalDurationSec,
    totalBytes: Math.round((bitsPerSecond / 8) * totalDurationSec),
  };
}
