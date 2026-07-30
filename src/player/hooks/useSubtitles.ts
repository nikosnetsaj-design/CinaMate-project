import { useState, useEffect, useCallback, useMemo } from 'react';
import type { SubtitleTrack, SubtitleStyle } from '../types';

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

const DEFAULT_STYLE: SubtitleStyle = {
  fontSize: 'medium',
  color: '#F5F1E8',
  backgroundColor: '#000000',
  backgroundOpacity: 0.6,
  position: 'bottom',
  syncOffsetMs: 0,
};

export function useSubtitles(tracks: SubtitleTrack[], currentTime: number) {
  const [activeSubtitleId, setActiveSubtitleId] = useState<string | null>(null);
  const [style, setStyle] = useState<SubtitleStyle>(DEFAULT_STYLE);
  const [cues, setCues] = useState<ParsedCue[]>([]);

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

  const selectSubtitle = useCallback((id: string | null) => setActiveSubtitleId(id), []);
  const updateStyle = useCallback(
    (patch: Partial<SubtitleStyle>) => setStyle(prev => ({ ...prev, ...patch })),
    []
  );

  return { activeSubtitleId, style, activeCueText: activeCue?.text ?? null, selectSubtitle, updateStyle };
}
