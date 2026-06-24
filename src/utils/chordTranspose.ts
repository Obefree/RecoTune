import { NOTE_NAMES } from './noteUtils';
import { normalizeChordSymbol } from './melodyChords';

const FLAT_TO_SHARP: Record<string, number> = {
  Db: 1,
  Eb: 3,
  Gb: 6,
  Ab: 8,
  Bb: 10,
};

function parseRoot(symbol: string): { rootIdx: number; rest: string } | null {
  const s = normalizeChordSymbol(symbol.trim());
  if (!s) return null;
  for (let len = 2; len >= 1; len--) {
    const candidate = s.slice(0, len);
    const idx = NOTE_NAMES.indexOf(candidate);
    if (idx >= 0) return { rootIdx: idx, rest: s.slice(len) };
    if (FLAT_TO_SHARP[candidate] != null) {
      return { rootIdx: FLAT_TO_SHARP[candidate], rest: s.slice(len) };
    }
    // German/Russian H = B natural (AmDm / pesni.ru). Transposes into English names.
    if (candidate === 'H' || candidate === 'h') {
      return { rootIdx: NOTE_NAMES.indexOf('B'), rest: s.slice(len) };
    }
  }
  return null;
}

/** Transpose one chord symbol by semitones (supports slash bass, e.g. F/A). */
export function transposeChordSymbol(symbol: string, semitones: number): string {
  if (!semitones) return symbol;
  const raw = symbol.trim();
  if (!raw) return symbol;

  const slash = raw.indexOf('/');
  if (slash >= 0) {
    const head = transposeChordSymbol(raw.slice(0, slash), semitones);
    const bass = transposeChordSymbol(raw.slice(slash + 1), semitones);
    return `${head}/${bass}`;
  }

  const parsed = parseRoot(raw);
  if (!parsed) return symbol;
  const nextRoot = NOTE_NAMES[((parsed.rootIdx + semitones) % 12 + 12) % 12];
  return `${nextRoot}${parsed.rest}`;
}

/** Transpose inline [Chord] markers in ChordPro / practice text. */
export function transposeChordProText(text: string, semitones: number): string {
  if (!semitones || !text) return text;
  return text.replace(/\[([^\]]+)\]/g, (full, chord) => {
    const inner = String(chord).trim();
    if (!/^[A-H]/i.test(inner)) return full;
    return `[${transposeChordSymbol(inner, semitones)}]`;
  });
}

/** Space-separated progression line (header chips). */
export function transposeChordProgression(text: string, semitones: number): string {
  if (!semitones || !text?.trim()) return text;
  return text
    .trim()
    .split(/([\s,|/]+)/)
    .map(part => {
      if (!part.trim() || /^[\s,|/]+$/.test(part)) return part;
      if (/^[A-H]/i.test(part.trim())) return transposeChordSymbol(part.trim(), semitones);
      return part;
    })
    .join('');
}

export function formatTransposeLabel(semitones: number): string {
  if (!semitones) return '0';
  return semitones > 0 ? `+${semitones}` : String(semitones);
}
