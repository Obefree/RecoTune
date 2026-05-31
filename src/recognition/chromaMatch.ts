import { NOTE_NAMES } from '../utils/noteUtils';

/** Parse catalog key like "G" or "Am" / "G major" into root + mode. */
export function parseSongKeyLabel(key?: string | null): {
  rootIdx: number;
  mode: 'major' | 'minor';
} | null {
  if (!key?.trim()) return null;
  const k = key.trim();
  const long = k.match(/^([A-Ga-g][#b]?)\s*(major|minor)$/i);
  if (long) {
    const rootIdx = NOTE_NAMES.indexOf(
      long[1].length === 1 ? long[1].toUpperCase() : long[1][0].toUpperCase() + long[1].slice(1),
    );
    if (rootIdx < 0) return null;
    return { rootIdx, mode: long[2].toLowerCase() as 'major' | 'minor' };
  }
  const short = k.match(/^([A-Ga-g][#b]?)(m)?$/);
  if (short) {
    const rootIdx = NOTE_NAMES.indexOf(
      short[1].length === 1 ? short[1].toUpperCase() : short[1][0].toUpperCase() + short[1].slice(1),
    );
    if (rootIdx < 0) return null;
    return { rootIdx, mode: short[2] ? 'minor' : 'major' };
  }
  return null;
}

export function parseEstimatedKeyLabel(label?: string | null): ReturnType<typeof parseSongKeyLabel> {
  if (!label?.trim()) return null;
  return parseSongKeyLabel(label);
}

/** 0…100 — same root/mode as estimated key from snippet. */
export function scoreKeyMatch(estimatedKey: string, songKey?: string): number {
  const est = parseEstimatedKeyLabel(estimatedKey);
  const song = parseSongKeyLabel(songKey);
  if (!est || !song) return 0;
  if (est.rootIdx !== song.rootIdx) return 0;
  if (est.mode === song.mode) return 92;
  return 48;
}

/** Cosine similarity of two 12-bin chroma vectors (0…100). */
export function scoreChromaVectors(a: number[], b: number[]): number {
  if (a.length !== 12 || b.length !== 12) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < 12; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na <= 0 || nb <= 0) return 0;
  const cos = dot / (Math.sqrt(na) * Math.sqrt(nb));
  return Math.round(Math.max(0, Math.min(1, cos)) * 100);
}

/** Major/minor pitch-class profile for a key root (12 bins). */
export function keyProfile(rootIdx: number, mode: 'major' | 'minor'): number[] {
  const major = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
  const minor = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
  const template = mode === 'minor' ? minor : major;
  const out = new Array(12).fill(0);
  for (let i = 0; i < 12; i++) out[(i + rootIdx) % 12] = template[i];
  const mx = Math.max(...out);
  if (mx > 0) for (let i = 0; i < 12; i++) out[i] /= mx;
  return out;
}

export function scoreChromaAgainstKey(chroma: number[], estimatedKey: string): number {
  const parsed = parseEstimatedKeyLabel(estimatedKey);
  if (!parsed || chroma.length !== 12) return 0;
  return scoreChromaVectors(chroma, keyProfile(parsed.rootIdx, parsed.mode));
}
