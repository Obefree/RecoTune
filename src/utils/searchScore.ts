import { normalizeSearchText, tokenizeQuery } from './searchNormalize';

export type MatchKind = 'exact' | 'prefix' | 'contains' | 'fuzzy' | 'none';

/** Levenshtein distance (short strings only). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const rows = a.length + 1;
  const cols = b.length + 1;
  const d: number[] = Array(rows * cols);
  for (let i = 0; i < rows; i++) d[i * cols] = i;
  for (let j = 0; j < cols; j++) d[j] = j;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i * cols + j] = Math.min(
        d[(i - 1) * cols + j] + 1,
        d[i * cols + (j - 1)] + 1,
        d[(i - 1) * cols + (j - 1)] + cost,
      );
    }
  }
  return d[(rows - 1) * cols + (cols - 1)];
}

function fuzzyRatio(a: string, b: string): number {
  if (!a || !b) return 0;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 0;
  const dist = levenshtein(a, b);
  return Math.max(0, 1 - dist / maxLen);
}

function fieldScore(queryNorm: string, fieldNorm: string, tokens: string[]): { score: number; kind: MatchKind } {
  if (!queryNorm || !fieldNorm) return { score: 0, kind: 'none' };

  if (fieldNorm === queryNorm) return { score: 200, kind: 'exact' };
  if (fieldNorm.startsWith(queryNorm)) return { score: 150, kind: 'prefix' };
  if (queryNorm.startsWith(fieldNorm) && fieldNorm.length >= 3) return { score: 140, kind: 'prefix' };
  if (fieldNorm.includes(queryNorm)) return { score: 100, kind: 'contains' };
  if (queryNorm.includes(fieldNorm) && fieldNorm.length >= 4) return { score: 90, kind: 'contains' };

  const allTokensHit = tokens.length > 0 && tokens.every(t => fieldNorm.includes(t));
  if (allTokensHit) return { score: 85, kind: 'contains' };

  const ratio = fuzzyRatio(queryNorm, fieldNorm);
  if (ratio >= 0.72) return { score: Math.round(40 + ratio * 50), kind: 'fuzzy' };

  if (tokens.length > 1) {
    let tokenSum = 0;
    for (const t of tokens) {
      if (fieldNorm.includes(t)) tokenSum += 30;
      else {
        const r = fuzzyRatio(t, fieldNorm.length <= t.length + 3 ? fieldNorm : fieldNorm.slice(0, Math.min(fieldNorm.length, t.length + 4)));
        if (r >= 0.65) tokenSum += Math.round(15 + r * 20);
      }
    }
    if (tokenSum > 0) return { score: tokenSum, kind: 'fuzzy' };
  }

  return { score: 0, kind: 'none' };
}

export function scoreSongAgainstQuery(
  query: string,
  title: string,
  artist: string,
): { score: number; kind: MatchKind } {
  const q = normalizeSearchText(query);
  if (!q) return { score: 0, kind: 'none' };

  const tokens = tokenizeQuery(query);
  const nt = normalizeSearchText(title);
  const na = normalizeSearchText(artist);
  const combined = `${na} ${nt}`.trim();
  const combinedRev = `${nt} ${na}`.trim();

  const scores: { score: number; kind: MatchKind }[] = [
    fieldScore(q, nt, tokens),
    fieldScore(q, na, tokens),
    fieldScore(q, combined, tokens),
    fieldScore(q, combinedRev, tokens),
  ];

  let best: { score: number; kind: MatchKind } = { score: 0, kind: 'none' };
  const kindRank: Record<MatchKind, number> = { exact: 4, prefix: 3, contains: 2, fuzzy: 1, none: 0 };
  for (const s of scores) {
    if (s.score > best.score || (s.score === best.score && kindRank[s.kind] > kindRank[best.kind])) {
      best = s;
    }
  }
  return best;
}

export const MATCH_KIND_ORDER: MatchKind[] = ['exact', 'prefix', 'contains', 'fuzzy', 'none'];

export function compareSearchHits(
  a: { score: number; kind: MatchKind; title: string },
  b: { score: number; kind: MatchKind; title: string },
): number {
  const kindRank: Record<MatchKind, number> = { exact: 4, prefix: 3, contains: 2, fuzzy: 1, none: 0 };
  const kd = kindRank[b.kind] - kindRank[a.kind];
  if (kd !== 0) return kd;
  if (b.score !== a.score) return b.score - a.score;
  return a.title.localeCompare(b.title);
}
