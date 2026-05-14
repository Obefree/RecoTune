import type { SongEntry } from '../data/songDatabase';

function headers(token?: string): HeadersInit {
  const h: Record<string, string> = { Accept: 'application/json' };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

/** Каталог без поля lyrics (экономия трафика). */
export async function fetchRemoteChordCatalog(
  baseUrl: string,
  token?: string,
): Promise<SongEntry[]> {
  const base = baseUrl.replace(/\/$/, '');
  const res = await fetch(`${base}/api/v1/catalog`, { headers: headers(token) });
  if (!res.ok) throw new Error(`catalog HTTP ${res.status}`);
  const data = (await res.json()) as { songs?: SongEntry[] };
  if (!data.songs || !Array.isArray(data.songs)) throw new Error('catalog: invalid JSON');
  return data.songs.map(
    (s): SongEntry => ({
      id: s.id,
      title: s.title,
      artist: s.artist,
      chords: s.chords,
      key: s.key,
      bpm: s.bpm,
      difficulty: s.difficulty,
      genre: s.genre,
    }),
  );
}

/** Полная песня с текстом. */
export async function fetchRemoteChordSong(
  baseUrl: string,
  id: string,
  token?: string,
): Promise<SongEntry | null> {
  const base = baseUrl.replace(/\/$/, '');
  const enc = encodeURIComponent(id);
  const res = await fetch(`${base}/api/v1/songs/${enc}`, { headers: headers(token) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`song HTTP ${res.status}`);
  const data = (await res.json()) as { song?: SongEntry };
  return data.song ?? null;
}
