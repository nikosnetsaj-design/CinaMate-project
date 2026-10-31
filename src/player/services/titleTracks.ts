/**
 * Le tracce di ciascun titolo — per una serie, di tutta la serie.
 *
 * La preferenza generale («l'italiano, sempre») resta in playbackPrefs. Ma
 * c'è chi guarda un anime in giapponese con i sottotitoli e una serie inglese
 * doppiata: con una preferenza sola, ogni cambio di serie la riscrive, e
 * l'altra serie riparte sbagliata. Qui la scelta fatta su un titolo vale per
 * quel titolo, e vince su quella generale; un titolo mai toccato segue la
 * generale come prima.
 *
 * Anche il ritardo dei sottotitoli: va di pari passo con i file di quella
 * serie, non con chi guarda.
 */
const KEY = 'ppv:title-tracks';
const LIMIT = 200;

export interface TitleTracks {
  /** `null` = sottotitoli spenti, per scelta. */
  subtitleLang?: string | null;
  audioLang?: string;
  syncOffsetMs?: number;
  at?: number;
}

type Store = Record<string, TitleTracks>;

function read(): Store {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? '{}') as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Store) : {};
  } catch {
    return {};
  }
}

export function getTitleTracks(titleId: string | undefined): TitleTracks {
  if (!titleId) return {};
  const entry = read()[titleId];
  if (!entry || typeof entry !== 'object') return {};
  return {
    subtitleLang: entry.subtitleLang === null || typeof entry.subtitleLang === 'string' ? entry.subtitleLang : undefined,
    audioLang: typeof entry.audioLang === 'string' ? entry.audioLang : undefined,
    syncOffsetMs:
      typeof entry.syncOffsetMs === 'number' && Number.isFinite(entry.syncOffsetMs)
        ? Math.min(30000, Math.max(-30000, entry.syncOffsetMs))
        : undefined,
  };
}

export function rememberTitleTracks(titleId: string | undefined, patch: TitleTracks): void {
  if (!titleId) return;
  const store = read();
  store[titleId] = { ...store[titleId], ...patch, at: Date.now() };
  // I titoli guardati meno di recente escono per primi: è una memoria di
  // comodo, non un archivio.
  const kept = Object.entries(store)
    .sort((a, b) => (b[1].at ?? 0) - (a[1].at ?? 0))
    .slice(0, LIMIT);
  try {
    localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(kept)));
  } catch {
    // Quota piena: la scelta vale per questa sessione.
  }
}
