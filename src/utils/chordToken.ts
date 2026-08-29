/**
 * Shared chord-token grammar for pesni.ru / AmDm / ChordPro.
 * H = German/Russian B. Keep tools/lib/chordNormalize.mjs in sync.
 */
export const CHORD_ROOT = '[A-H](?:#|b|♯|♭)?';
/** Repeatable pieces: A7sus4, Dmadd9, Em11, D6sus2 — not a single suffix. */
export const CHORD_PIECE =
  '(?:maj7|maj9|maj|min|dim7|dim|aug|sus4|sus2|sus|add\\d+|m7b5|m7-5|m11|m13|m7|m9|m6|m(?!aj)|6\\/9|7\\+|7-|9\\+|11|13|7|9|6|2|4|5|°|Ø|\\+)';
/** pesni.ru: Hm7/5- (= m7b5), 7/5+, +5, b5 */
export const CHORD_ALTER = '(?:\\/(?:5[-+−]|9|11)|[-+−]5|b5|#5)?';
export const CHORD_BASS = `(?:\\/${CHORD_ROOT})?`;
/** AmDm fret: Dm(V), C(VII) */
export const CHORD_FRET = '(?:\\(\\s*(?:[IVXivx]+|\\d{1,2})\\s*\\))?';
export const CHORD_TOKEN = `${CHORD_ROOT}${CHORD_PIECE}*${CHORD_ALTER}${CHORD_BASS}${CHORD_FRET}`;

export const CHORD_TOKEN_RE = new RegExp(`^${CHORD_TOKEN}$`, 'i');
export const CHORD_MARKER_RE = new RegExp(`\\[${CHORD_TOKEN}\\]`, 'i');
export const CHORD_BRACKET_GLOBAL_RE = new RegExp(`\\[(${CHORD_TOKEN})\\]`, 'gi');

const KEEP_IN_CORE = /[A-Za-z0-9[\]#♯♭/+−-]/;

export function splitChordPunctuation(token: string): {
  lead: string;
  core: string;
  trail: string;
} {
  let start = 0;
  while (start < token.length && !KEEP_IN_CORE.test(token[start])) start += 1;
  let end = token.length;
  while (end > start && !KEEP_IN_CORE.test(token[end - 1])) end -= 1;
  return {
    lead: token.slice(0, start),
    core: token.slice(start, end),
    trail: token.slice(end),
  };
}

export function isAlterationBass(bass: string): boolean {
  return /^(?:5[-+−]|9|11)$/.test(bass.trim());
}
