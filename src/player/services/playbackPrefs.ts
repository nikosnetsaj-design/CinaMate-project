import type { SubtitleStyle } from '../types';

const KEY = 'ppv:playback-prefs';

/** Fired after any change, so every hook reading these redraws together. */
export const PREFS_EVENT = 'cinemate:playback-prefs';

/**
 * What to do when a title reaches an intro, a recap or the closing credits.
 * `manual` shows the button and waits — the default, because a player that
 * skips something you wanted to watch is worse than one that asks.
 */
export type AutoSkipMode = 'manual' | 'intro' | 'all';

export interface PlaybackPrefs {
  volume: number;
  muted: boolean;
  playbackRate: number;
  /**
   * ISO 639-1 code of the subtitle track to turn on by itself, or `null` for
   * "no subtitles". `undefined` means never chosen: the player then leaves
   * subtitles alone instead of deciding for you the first time.
   */
  subtitleLang?: string | null;
  /** Same idea for the audio track — a dub you always pick, picked for you. */
  audioLang?: string;
  subtitleStyle: SubtitleStyle;
  autoSkip: AutoSkipMode;
  /** Whether the next episode starts by itself when one is queued. */
  autoplayNext: boolean;
  /** Hold a Screen Wake Lock while playing, so the phone stops dimming. */
  keepScreenAwake: boolean;
  /** Ceiling in pixels of height, e.g. 720 — `null` for no ceiling. */
  maxHeight: number | null;
}

export const DEFAULT_SUBTITLE_STYLE: SubtitleStyle = {
  fontSize: 'medium',
  color: '#F5F1E8',
  backgroundColor: '#000000',
  backgroundOpacity: 0.6,
  position: 'bottom',
  syncOffsetMs: 0,
};

const DEFAULTS: PlaybackPrefs = {
  volume: 1,
  muted: false,
  playbackRate: 1,
  subtitleStyle: DEFAULT_SUBTITLE_STYLE,
  autoSkip: 'manual',
  autoplayNext: true,
  keepScreenAwake: true,
  maxHeight: null,
};

function clamp(n: unknown, min: number, max: number, fallback: number): number {
  return typeof n === 'number' && Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

/**
 * Read defensively: these values are handed straight to a media element, and a
 * `volume` of `null` from a hand-edited file would throw on assignment and take
 * the whole player down with it.
 */
function coerce(raw: unknown): PlaybackPrefs {
  if (!raw || typeof raw !== 'object') return { ...DEFAULTS };
  const r = raw as Partial<PlaybackPrefs>;
  const style = (r.subtitleStyle ?? {}) as Partial<SubtitleStyle>;
  return {
    volume: clamp(r.volume, 0, 1, DEFAULTS.volume),
    muted: typeof r.muted === 'boolean' ? r.muted : DEFAULTS.muted,
    playbackRate: clamp(r.playbackRate, 0.25, 4, DEFAULTS.playbackRate),
    subtitleLang: r.subtitleLang === null || typeof r.subtitleLang === 'string' ? r.subtitleLang : undefined,
    audioLang: typeof r.audioLang === 'string' ? r.audioLang : undefined,
    subtitleStyle: {
      fontSize: (['small', 'medium', 'large', 'extraLarge'] as const).includes(style.fontSize as never)
        ? (style.fontSize as SubtitleStyle['fontSize'])
        : DEFAULT_SUBTITLE_STYLE.fontSize,
      color: typeof style.color === 'string' ? style.color : DEFAULT_SUBTITLE_STYLE.color,
      backgroundColor:
        typeof style.backgroundColor === 'string' ? style.backgroundColor : DEFAULT_SUBTITLE_STYLE.backgroundColor,
      backgroundOpacity: clamp(style.backgroundOpacity, 0, 1, DEFAULT_SUBTITLE_STYLE.backgroundOpacity),
      position: style.position === 'top' ? 'top' : 'bottom',
      syncOffsetMs: clamp(style.syncOffsetMs, -30000, 30000, 0),
    },
    autoSkip: r.autoSkip === 'intro' || r.autoSkip === 'all' ? r.autoSkip : DEFAULTS.autoSkip,
    autoplayNext: typeof r.autoplayNext === 'boolean' ? r.autoplayNext : DEFAULTS.autoplayNext,
    keepScreenAwake: typeof r.keepScreenAwake === 'boolean' ? r.keepScreenAwake : DEFAULTS.keepScreenAwake,
    maxHeight: typeof r.maxHeight === 'number' && r.maxHeight > 0 ? r.maxHeight : null,
  };
}

let cache: PlaybackPrefs | null = null;

export function getPlaybackPrefs(): PlaybackPrefs {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = coerce(raw ? JSON.parse(raw) : null);
  } catch {
    cache = { ...DEFAULTS };
  }
  return cache;
}

export function setPlaybackPrefs(patch: Partial<PlaybackPrefs>) {
  const next = coerce({ ...getPlaybackPrefs(), ...patch });
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Quota or private mode: the preference still applies for this session.
  }
  try {
    window.dispatchEvent(new Event(PREFS_EVENT));
  } catch {
    /* no window — nothing to notify */
  }
}

export function resetPlaybackPrefs() {
  cache = { ...DEFAULTS };
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing to remove */
  }
  try {
    window.dispatchEvent(new Event(PREFS_EVENT));
  } catch {
    /* no window */
  }
}

/**
 * The language of a track, normalised to a bare ISO 639-1 code.
 *
 * Sources write this field however they like — `it`, `ita`, `it-IT`, `Italiano`
 * — and a preference that only matched one spelling would silently stop working
 * the day you pointed the player at a different server.
 */
export function normaliseLang(raw: string | undefined | null): string {
  if (!raw) return '';
  const value = raw.trim().toLowerCase();
  const base = value.split(/[-_]/)[0];
  const THREE_TO_TWO: Record<string, string> = {
    ita: 'it', eng: 'en', spa: 'es', fra: 'fr', fre: 'fr', deu: 'de', ger: 'de',
    jpn: 'ja', kor: 'ko', por: 'pt', rus: 'ru', zho: 'zh', chi: 'zh', nld: 'nl', dut: 'nl',
  };
  const NAMES: Record<string, string> = {
    italiano: 'it', italian: 'it', inglese: 'en', english: 'en', spagnolo: 'es', spanish: 'es',
    francese: 'fr', french: 'fr', tedesco: 'de', german: 'de', giapponese: 'ja', japanese: 'ja',
  };
  return NAMES[value] ?? THREE_TO_TWO[base] ?? base;
}
