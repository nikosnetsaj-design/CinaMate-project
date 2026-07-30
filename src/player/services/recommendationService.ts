import type { MediaContent } from '../types';

export type Recommendation = {
  id: string;
  title: string;
  posterUrl: string;
  type: 'similar' | 'next_episode' | 'next_saga' | 'related' | 'universe';
  /** True when selecting it will actually start playback. */
  playable?: boolean;
  /** One short line saying why this is being suggested. */
  reason?: string;
};

// Replace with a real call to your recommendation backend/ML service. The
// fallback below (built from data already on the content object) keeps the
// end screen usable during local development and if the API is unreachable.
export async function getEndScreenRecommendations(content: MediaContent): Promise<Recommendation[]> {
  try {
    const res = await fetch(`/api/content/${content.id}/recommendations`);
    if (res.ok) return (await res.json()) as Recommendation[];
  } catch {
    // fall through to local fallback
  }

  const fallback: Recommendation[] = [];
  if (content.nextEpisode) {
    fallback.push({
      id: content.nextEpisode.id,
      title: content.nextEpisode.title,
      posterUrl: content.nextEpisode.posterUrl,
      type: 'next_episode',
      playable: true,
      reason: 'Episodio successivo',
    });
  }
  if (content.nextInSaga) {
    fallback.push({
      id: content.nextInSaga.id,
      title: content.nextInSaga.title,
      posterUrl: content.nextInSaga.posterUrl,
      type: 'next_saga',
      playable: true,
      reason: 'Prossimo nella saga',
    });
  }
  return fallback;
}
