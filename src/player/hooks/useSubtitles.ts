import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { SubtitleTrack, SubtitleStyle } from '../types';
import { getPlaybackPrefs, normaliseLang, setPlaybackPrefs } from '../services/playbackPrefs';

// A small custom subtitle renderer (rather than relying on native <track> +
// ::cue) is used so that size/color/background/position are fully and
// reliably controllable from JS — the native ::cue pseudo-element has
// inconsistent cross-browser support for some of these properties.

export type ParsedCue = { start: number; end: number; text: string };

function toSeconds(t: string): number {
  const parts = t.replace(',', '.').trim().split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return (parts[0] || 0) * 60 + (parts[1] || 0);
}

/**
 * Reads WebVTT *and* SubRip.
 *
 * The two formats differ in exactly two ways that matter here: SRT numbers its
 * blocks and writes its milliseconds after a comma. Numbered lines never match
 * the timing pattern so they are skipped anyway, and the comma is normalised in
 * `toSeconds` — which makes `.srt` work, and it is worth saying out loud,
 * because `.srt` is what a subtitle downloaded anywhere actually is.
 */
export function parseVtt(raw: string): ParsedCue[] {
  const lines = raw.replace(/\r/g, '').split('\n');
  const cues: ParsedCue[] = [];
  const timeRe = /(\d{2}:)?\d{2}:\d{2}[.,]\d{3}\s*-->\s*(\d{2}:)?\d{2}:\d{2}[.,]\d{3}/;
  let i = 0;
  while (i < lines.length) {
    if (timeRe.test(lines[i])) {
      const [startStr, endStr] = lines[i].split('-->').map(s => s.trim().split(' ')[0]);
      const start = toSeconds(startStr);
      const end = toSeconds(endStr);
      i++;
      const textLines: string[] = [];
      while (i < lines.length && lines[i].trim() !== '') {
        textLines.push(lines[i]);
        i++;
      }
      cues.push({ start, end, text: textLines.join('\n').replace(/<[^>]+>/g, '') });
    }
    i++;
  }
  return cues;
}

async function fetchAndParseVtt(url: string): Promise<ParsedCue[]> {
  const res = await fetch(url);
  if (!res.ok) return [];
  return parseVtt(await res.text());
}

export function useSubtitles(tracks: SubtitleTrack[], currentTime: number) {
  const [activeSubtitleId, setActiveSubtitleId] = useState<string | null>(null);
  // Read once from storage rather than reset to a default: subtitle size and
  // sync are accessibility settings for some people, and an app that forgets
  // them at every episode is an app they have to configure to use.
  const [style, setStyle] = useState<SubtitleStyle>(() => getPlaybackPrefs().subtitleStyle);
  const [cues, setCues] = useState<ParsedCue[]>([]);

  /**
   * Turns on the language you always turn on.
   *
   * Keyed on the track list, so it re-runs for each new episode — that is the
   * whole point. `subtitleLang === undefined` means the preference has never
   * been expressed, and then nothing is touched: deciding for someone who has
   * never asked is how a player ends up putting subtitles on a film they were
   * watching without them.
   */
  const trackSignature = tracks.map((t) => `${t.id}:${t.language}`).join('|');
  const appliedForRef = useRef<string | null>(null);
  useEffect(() => {
    if (appliedForRef.current === trackSignature) return;
    appliedForRef.current = trackSignature;
    const wanted = getPlaybackPrefs().subtitleLang;
    if (wanted === undefined) return;
    if (wanted === null) {
      setActiveSubtitleId(null);
      return;
    }
    const match = tracks.find((t) => normaliseLang(t.language) === normaliseLang(wanted));
    setActiveSubtitleId(match?.id ?? null);
  }, [trackSignature, tracks]);

  useEffect(() => {
    const track = tracks.find(t => t.id === activeSubtitleId);
    if (!track) {
      setCues([]);
      return;
    }
    let cancelled = false;
    fetchAndParseVtt(track.url)
      .then(parsed => {
        if (!cancelled) setCues(parsed);
      })
      .catch(() => {
        if (!cancelled) setCues([]);
      });
    return () => {
      cancelled = true;
    };
  }, [activeSubtitleId, tracks]);

  const adjustedTime = currentTime + style.syncOffsetMs / 1000;
  const activeCue = useMemo(
    () => cues.find(c => adjustedTime >= c.start && adjustedTime < c.end) ?? null,
    [cues, adjustedTime]
  );

  // Both writers persist as well as set: choosing a language here is what
  // teaches the next episode, and turning subtitles off is just as much a
  // choice as turning them on — stored as an explicit `null`, distinct from
  // the `undefined` that means "never asked".
  const selectSubtitle = useCallback(
    (id: string | null) => {
      setActiveSubtitleId(id);
      const track = id ? tracks.find((t) => t.id === id) : null;
      setPlaybackPrefs({ subtitleLang: track ? normaliseLang(track.language) : null });
    },
    [tracks],
  );
  const updateStyle = useCallback((patch: Partial<SubtitleStyle>) => {
    setStyle((prev) => {
      const next = { ...prev, ...patch };
      setPlaybackPrefs({ subtitleStyle: next });
      return next;
    });
  }, []);

  return { activeSubtitleId, style, activeCueText: activeCue?.text ?? null, selectSubtitle, updateStyle };
}
