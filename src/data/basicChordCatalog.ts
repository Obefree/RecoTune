/**
 * Chord reference sections for the Chords screen (practice + справочник).
 * Spelling matches keys in chordShapes TABLES (ASCII: C#, Db, …).
 */
import { getChordShapeExact, listChordShapeKeys } from './chordShapes';
import { normalizeChordSymbol, parseRoot } from './chordShapeResolve';

const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] as const;

/** Unicode for section headings */
const SHARP_LBL = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'] as const;
const FLAT_LBL = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'] as const;

const ROOT_TO_SEMITONE: Record<string, number> = {
  C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6,
  G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11,
};

const SUFFIX_ORDER = [
  '', 'm', '7', 'maj7', 'm7', 'sus2', 'sus4', 'dim', 'aug', 'add9',
  '6', '9', '11', '13', 'm7b5',
];

export type BasicCatalogEntry = {
  name: string;
  label: string;
};

export type BasicCatalogSection = {
  title: string;
  entries: BasicCatalogEntry[];
};

function firstAvailable(diagramId: string, candidates: string[]): string | null {
  for (const c of candidates) {
    if (getChordShapeExact(diagramId, c)) return c;
  }
  return null;
}

function pushUnique(out: BasicCatalogEntry[], name: string | null, label: string) {
  if (!name) return;
  if (out.some(e => e.name === name)) return;
  out.push({ name, label });
}

function suffixRank(symbol: string): number {
  const parsed = parseRoot(normalizeChordSymbol(symbol));
  if (!parsed) return 99;
  const rest = parsed.rest.toLowerCase();
  const idx = SUFFIX_ORDER.indexOf(rest);
  if (idx >= 0) return idx;
  if (rest.includes('sus4')) return SUFFIX_ORDER.indexOf('sus4');
  if (rest.includes('sus2')) return SUFFIX_ORDER.indexOf('sus2');
  if (rest.includes('dim')) return SUFFIX_ORDER.indexOf('dim');
  if (rest.includes('aug')) return SUFFIX_ORDER.indexOf('aug');
  if (rest.includes('add')) return SUFFIX_ORDER.indexOf('add9');
  return 50 + rest.length;
}

function qualityLabel(symbol: string): string {
  const parsed = parseRoot(normalizeChordSymbol(symbol));
  if (!parsed) return symbol;
  const r = parsed.rest;
  if (!r) return 'маж.';
  const map: Record<string, string> = {
    m: 'мин.',
    '7': '7',
    maj7: 'maj7',
    m7: 'm7',
    sus2: 'sus2',
    sus4: 'sus4',
    dim: 'dim',
    aug: 'aug',
    add9: 'add9',
  };
  return map[r] ?? r;
}

/**
 * Core qualities per chromatic step (quick «основные» subset).
 */
export function getBasicChordCatalog(diagramId: string): BasicCatalogSection[] {
  const sections: BasicCatalogSection[] = [];

  for (let i = 0; i < 12; i++) {
    const sr = SHARP_NAMES[i];
    const fr = FLAT_NAMES[i];
    const title = sr === fr ? SHARP_LBL[i] : `${SHARP_LBL[i]} / ${FLAT_LBL[i]}`;
    const entries: BasicCatalogEntry[] = [];

    pushUnique(entries, firstAvailable(diagramId, [sr, fr]), 'маж.');
    pushUnique(entries, firstAvailable(diagramId, [`${sr}m`, `${fr}m`]), 'мин.');
    pushUnique(entries, firstAvailable(diagramId, [`${sr}7`, `${fr}7`]), '7');
    pushUnique(entries, firstAvailable(diagramId, [`${sr}maj7`, `${fr}maj7`]), 'maj7');
    pushUnique(entries, firstAvailable(diagramId, [`${sr}m7`, `${fr}m7`]), 'm7');
    pushUnique(entries, firstAvailable(diagramId, [`${sr}sus2`, `${fr}sus2`]), 'sus2');
    pushUnique(entries, firstAvailable(diagramId, [`${sr}sus4`, `${fr}sus4`]), 'sus4');
    pushUnique(entries, firstAvailable(diagramId, [`${sr}dim`, `${fr}dim`]), 'dim');
    pushUnique(entries, firstAvailable(diagramId, [`${sr}aug`, `${fr}aug`]), 'aug');
    pushUnique(entries, firstAvailable(diagramId, [`${sr}add9`, `${fr}add9`]), 'add9');

    if (entries.length > 0) sections.push({ title, entries });
  }

  return sections;
}

/**
 * Every fingering in the instrument table, grouped by root (полный справочник).
 */
export function getFullChordReferenceCatalog(diagramId: string): BasicCatalogSection[] {
  const keys = listChordShapeKeys(diagramId);
  const byRoot = new Map<number, string[]>();

  for (const key of keys) {
    const parsed = parseRoot(normalizeChordSymbol(key));
    if (!parsed) continue;
    const semi = ROOT_TO_SEMITONE[parsed.root];
    if (semi == null) continue;
    const list = byRoot.get(semi) ?? [];
    list.push(key);
    byRoot.set(semi, list);
  }

  const sections: BasicCatalogSection[] = [];
  for (let i = 0; i < 12; i++) {
    const list = byRoot.get(i);
    if (!list?.length) continue;
    const sr = SHARP_NAMES[i];
    const fr = FLAT_NAMES[i];
    const title = sr === fr ? SHARP_LBL[i] : `${SHARP_LBL[i]} / ${FLAT_LBL[i]}`;
    const sorted = [...list].sort((a, b) => suffixRank(a) - suffixRank(b) || a.localeCompare(b));
    sections.push({
      title,
      entries: sorted.map(name => ({ name, label: qualityLabel(name) })),
    });
  }
  return sections;
}
