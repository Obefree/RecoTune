/** Текст песен: lyrics.ovh (без сторонних music-ID API). */

export function normalizeLyricsChords(text: string): string {
  return text.trim().replace(/\(([A-G][#b]?[^)]{0,8})\)\s*/g, '[$1]');
}

export async function fetchLyricsOvh(artist: string, title: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`,
    );
    const data = await res.json();
    if (!data.error && data.lyrics) return normalizeLyricsChords(data.lyrics);
  } catch { /* offline */ }
  return null;
}

export async function fetchLyricsForTrack(
  artist: string,
  title: string,
): Promise<{ text: string | null; source: 'ovh' | null }> {
  const fromOvh = await fetchLyricsOvh(artist, title);
  if (fromOvh) return { text: fromOvh, source: 'ovh' };
  return { text: null, source: null };
}
