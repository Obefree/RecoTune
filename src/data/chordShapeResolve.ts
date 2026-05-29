/**
 * Resolve song chord symbols to fingerings in chordShapes tables.
 * Tries exact key, enharmonic spellings, slash-chord root, and simplified fallbacks.
 */
import { getChordShape as lookupExact, type ChordShape } from './chordShapes';

const ROOTS = ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B'] as const;

const ENHARMONIC: Record<string, string> = {
  'C#': 'Db', Db: 'C#',
  'D#': 'Eb', Eb: 'D#',
  'F#': 'Gb', Gb: 'F#',
  'G#': 'Ab', Ab: 'G#',
  'A#': 'Bb', Bb: 'A#',
};

export type ResolvedChordShape = {
  shape: ChordShape;
  /** Key in the shapes table (may differ from input, e.g. Eb vs D#). */
  resolvedName: string;
};

export function normalizeChordSymbol(raw: string): string {
  return raw
    .trim()
    .replace(/♯/g, '#')
    .replace(/♭/g, 'b')
    .replace(/°/g, 'dim')
    .replace(/ø/gi, 'm7b5')
    .replace(/\s+/g, '');
}

function stripBassNote(symbol: string): string {
  const slash = symbol.indexOf('/');
  return slash > 0 ? symbol.slice(0, slash) : symbol;
}

export function parseRoot(symbol: string): { root: string; rest: string } | null {
  for (let len = 2; len >= 1; len--) {
    const root = symbol.slice(0, len);
    if ((ROOTS as readonly string[]).includes(root)) {
      return { root, rest: symbol.slice(len) };
    }
  }
  return null;
}

function enharmonicVariants(symbol: string): string[] {
  const out: string[] = [symbol];
  const parsed = parseRoot(symbol);
  if (!parsed) return out;
  const alt = ENHARMONIC[parsed.root];
  if (alt) out.push(alt + parsed.rest);
  return out;
}

/** Ordered fallback symbols for chords not in the table (no fake shapes). */
function fallbackSymbols(symbol: string): string[] {
  const chain: string[] = [];
  const push = (s: string) => {
    const n = normalizeChordSymbol(s);
    if (n && !chain.includes(n)) chain.push(n);
  };

  push(symbol);

  const s = stripBassNote(symbol);
  if (s !== symbol) push(s);

  if (/m7b5/i.test(s)) {
    push(s.replace(/m7b5/gi, 'dim'));
  }

  if (/sus4/i.test(s)) {
    const p = parseRoot(s);
    if (p) {
      push(p.root + 'sus4');
      if (/7sus4|7?sus4/i.test(s)) {
        push(p.root + '7');
        push(p.root);
      }
    }
  } else if (/sus2/i.test(s)) {
    const p = parseRoot(s);
    if (p) push(p.root + 'sus2');
  }

  if (/add9/i.test(s)) {
    push(s.replace(/add9/i, ''));
  }
  if (/add\d+/i.test(s)) {
    push(s.replace(/add\d+/i, ''));
  }

  const stripSuffix = (re: RegExp) => {
    if (re.test(s)) push(s.replace(re, ''));
  };
  stripSuffix(/maj7$/i);
  stripSuffix(/m7$/i);
  stripSuffix(/7$/i);
  stripSuffix(/9$/i);
  stripSuffix(/11$/i);
  stripSuffix(/13$/i);
  stripSuffix(/6$/i);
  stripSuffix(/dim$/i);
  stripSuffix(/aug$/i);
  stripSuffix(/sus[24]$/i);
  stripSuffix(/m$/i);

  const p = parseRoot(s);
  if (p && p.rest === 'min') push(p.root + 'm');

  return chain;
}

export function resolveChordShape(diagramId: string, chordName: string): ResolvedChordShape | null {
  const raw = chordName.trim();
  if (!raw || raw === '—' || raw === '?') return null;

  const normalized = normalizeChordSymbol(raw);
  const candidates: string[] = [];
  for (const base of fallbackSymbols(normalized)) {
    for (const v of enharmonicVariants(base)) {
      if (!candidates.includes(v)) candidates.push(v);
    }
  }

  for (const key of candidates) {
    const shape = lookupExact(diagramId, key);
    if (shape) return { shape, resolvedName: key };
  }
  return null;
}

export function getChordShape(diagramId: string, chordName: string): ChordShape | null {
  return resolveChordShape(diagramId, chordName)?.shape ?? null;
}
