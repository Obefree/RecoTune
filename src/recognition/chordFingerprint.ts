/** Нормализация прогрессии аккордов для сравнения с каталогом. */

const CHORD_TOKEN = /\b([A-G][#b]?(?:m|maj7|m7|7|dim|aug|sus[24])?)\b/gi;

export function chordTokens(chords: string): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(CHORD_TOKEN.source, CHORD_TOKEN.flags);
  while ((m = re.exec(chords)) !== null) {
    out.push(m[1].replace(/\s/g, ''));
  }
  return out;
}

/** 0…100 — доля совпадения токенов (порядок учитывается слабо). */
export function scoreChordProgression(query: string, libraryChords: string): number {
  const q = chordTokens(query);
  const lib = chordTokens(libraryChords);
  if (q.length < 2 || lib.length < 2) return 0;
  const qSet = new Set(q.map(t => t.toLowerCase()));
  let hits = 0;
  for (const t of lib) {
    if (qSet.has(t.toLowerCase())) hits++;
  }
  const ratio = hits / Math.max(q.length, lib.length);
  return Math.round(ratio * 100);
}
