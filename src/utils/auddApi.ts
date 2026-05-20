/** AudD — распознавание записи. Токен: EXPO_PUBLIC_AUDD_TOKEN в .env или "test" (малый лимит). */
export const AUDD_API_TOKEN =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_AUDD_TOKEN) || 'test';

export interface AuddTrackResult {
  artist: string;
  title: string;
  album?: string;
  release_date?: string;
  song_link?: string;
  lyrics?: string | { lyrics?: string };
}

export type AuddRecognizeOutcome =
  | { status: 'success'; result: AuddTrackResult }
  | { status: 'limit' }
  | { status: 'not_found' }
  | { status: 'network' }
  | { status: 'error'; message: string };

function extractLyricsFromResult(result: AuddTrackResult): string | null {
  const raw = result.lyrics;
  if (!raw) return null;
  if (typeof raw === 'string') return raw.trim() || null;
  if (typeof raw === 'object' && typeof raw.lyrics === 'string') return raw.lyrics.trim() || null;
  return null;
}

/** Нормализация (Am) → [Am] для ChordLyricsLine */
export function normalizeLyricsChords(text: string): string {
  return text.trim().replace(/\(([A-G][#b]?[^)]{0,8})\)\s*/g, '[$1]');
}

export async function auddRecognizeBase64(base64: string): Promise<AuddRecognizeOutcome> {
  const form = new FormData();
  (form as any).append('api_token', AUDD_API_TOKEN);
  (form as any).append('audio', base64);
  (form as any).append('return', 'apple_music,spotify,lyrics');

  try {
    const res = await fetch('https://api.audd.io/', { method: 'POST', body: form as any });
    const data = await res.json();
    if (data.status === 'success' && data.result) {
      return { status: 'success', result: data.result as AuddTrackResult };
    }
    if (data.status === 'error' && data.error?.error_code === 901) {
      return { status: 'limit' };
    }
    return { status: 'not_found' };
  } catch {
    return { status: 'network' };
  }
}

export async function fetchLyricsOvh(artist: string, title: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`,
    );
    const data = await res.json();
    if (!data.error && data.lyrics) return normalizeLyricsChords(data.lyrics);
  } catch {}
  return null;
}

/** AudD lyrics → lyrics.ovh */
export async function fetchLyricsForTrack(
  result: AuddTrackResult,
): Promise<{ text: string | null; source: 'audd' | 'ovh' | null }> {
  const fromAudd = extractLyricsFromResult(result);
  if (fromAudd) {
    return { text: normalizeLyricsChords(fromAudd), source: 'audd' };
  }
  const fromOvh = await fetchLyricsOvh(result.artist, result.title);
  if (fromOvh) return { text: fromOvh, source: 'ovh' };
  return { text: null, source: null };
}
