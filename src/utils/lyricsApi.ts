/** Текст песен: lyrics.ovh (plain text only — not ChordPro / not for practice tab). */

export async function fetchLyricsOvh(artist: string, title: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`,
    );
    const data = await res.json();
    if (!data.error && data.lyrics) return String(data.lyrics).trim() || null;
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
