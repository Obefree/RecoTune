/**
 * Chord fingerings for chord diagram UI (Chords screen).
 * frets[]: low → high string (left → right on diagram), same convention as guitar 6.
 * -1 = muted, 0 = open, N = fret; barre optional; barreFromString = first string index included in barre (0-based).
 */

export type ChordShape = { frets: number[]; barre?: number; barreFromString?: number };

export type ChordDiagramOption = {
  id: string;
  label: string;
  /** Tiny tuning hint under control name */
  tuningHint: string;
  stringLabels: string[];
};

export const CHORD_DIAGRAM_OPTIONS: ChordDiagramOption[] = [
  { id: 'guitar6', label: 'Гитара 6', tuningHint: 'E A D G B e', stringLabels: ['E','A','D','G','B','e'] },
  { id: 'guitar7', label: 'Гитара 7', tuningHint: 'B E A D G B e', stringLabels: ['B','E','A','D','G','B','e'] },
  { id: 'ukulele', label: 'Укулеле', tuningHint: 'G C E A', stringLabels: ['G','C','E','A'] },
  { id: 'mandolin', label: 'Мандолина', tuningHint: 'G D A E', stringLabels: ['G','D','A','E'] },
  { id: 'bass4', label: 'Бас 4', tuningHint: 'E A D G', stringLabels: ['E','A','D','G'] },
];

/** Standard 6-string guitar — string order E6 … e1 */
const GUITAR6: Record<string, ChordShape> = {
  'C':    { frets: [-1,3,2,0,1,0] },    'Cm':   { frets: [-1,3,5,5,4,3], barre:3 },
  'C7':   { frets: [-1,3,2,3,1,0] },    'Cmaj7':{ frets: [-1,3,2,0,0,0] },
  'Cadd9':{ frets: [-1,3,2,0,3,3] },    'Csus2':{ frets: [-1,3,0,0,1,3] },
  'D':    { frets: [-1,-1,0,2,3,2] },   'Dm':   { frets: [-1,-1,0,2,3,1] },
  'D7':   { frets: [-1,-1,0,2,1,2] },   'Dmaj7':{ frets: [-1,-1,0,2,2,2] },
  'Dsus2':{ frets: [-1,-1,0,2,3,0] },   'Dsus4':{ frets: [-1,-1,0,2,3,3] },
  'E':    { frets: [0,2,2,1,0,0] },     'Em':   { frets: [0,2,2,0,0,0] },
  'E7':   { frets: [0,2,0,1,0,0] },     'Emaj7':{ frets: [0,2,1,1,0,0] },
  'F':    { frets: [1,3,3,2,1,1], barre:1 }, 'Fm': { frets: [1,3,3,1,1,1], barre:1 },
  'F7':   { frets: [1,3,1,2,1,1], barre:1 }, 'Fmaj7':{ frets: [-1,-1,3,2,1,0] },
  'G':    { frets: [3,2,0,0,0,3] },     'Gm':   { frets: [3,5,5,3,3,3], barre:3 },
  'G7':   { frets: [3,2,0,0,0,1] },     'Gmaj7':{ frets: [3,2,0,0,0,2] },
  'A':    { frets: [-1,0,2,2,2,0] },    'Am':   { frets: [-1,0,2,2,1,0] },
  'A7':   { frets: [-1,0,2,0,2,0] },    'Amaj7':{ frets: [-1,0,2,1,2,0] },
  'Asus2':{ frets: [-1,0,2,2,0,0] },    'Asus4':{ frets: [-1,0,2,2,3,0] },
  'B':    { frets: [-1,2,4,4,4,2], barre:2 }, 'Bm':  { frets: [-1,2,4,4,3,2], barre:2 },
  'B7':   { frets: [-1,2,1,2,0,2] },    'Bmaj7':{ frets: [-1,2,4,3,4,2], barre:2 },
  'Bb':   { frets: [-1,1,3,3,3,1], barre:1 }, 'Bbm': { frets: [-1,1,3,3,2,1], barre:1 },
  'F#m':  { frets: [2,4,4,2,2,2], barre:2 }, 'C#m': { frets: [-1,4,6,6,5,4], barre:4 },
  'G#m':  { frets: [4,6,6,4,4,4], barre:4 }, 'D#m': { frets: [-1,6,8,8,7,6], barre:6 },
  'Am7':  { frets: [-1,0,2,0,1,0] },    'Em7':  { frets: [0,2,2,0,3,0] },
  'Dm7':  { frets: [-1,-1,0,2,1,1] },   'Bm7':  { frets: [-1,2,4,2,3,2], barre:2 },
  'Cm7':  { frets: [-1,3,5,3,4,3], barre:3 }, 'Fm7': { frets: [1,3,1,1,1,1], barre:1 },
  'A7sus4': { frets: [-1,0,2,0,3,0] },
  'Esus4':{ frets: [0,2,2,2,0,0] },    'Gsus4':{ frets: [3,2,0,0,1,3] },
  'Bsus4':{ frets: [-1,2,4,4,0,2], barre:2 },
  'Adim': { frets: [-1,-1,0,1,0,1] },  'Bdim': { frets: [-1,2,3,2,3,2] },
  'Cdim': { frets: [-1,3,4,3,4,3], barre:3 }, 'Ddim': { frets: [-1,-1,0,1,0,1] },
  'Edim': { frets: [0,1,2,0,2,0] },    'Fdim': { frets: [1,2,3,1,3,1], barre:1 },
  'Gdim': { frets: [3,4,3,4,3,4], barre:3 },
  'Caug': { frets: [-1,3,2,1,1,0] },  'Eaug': { frets: [0,3,2,1,1,0] },
  'Gaug': { frets: [3,2,1,0,0,3] },   'Aaug': { frets: [-1,0,1,2,2,1] },
  'Daug': { frets: [-1,-1,0,3,3,2] },
};

/** Low B + 6-string shapes; low B usually muted; barre drawn from 2nd string when first is muted */
function buildGuitar7(): Record<string, ChordShape> {
  const out: Record<string, ChordShape> = {};
  for (const [k, v] of Object.entries(GUITAR6)) {
    const frets = [-1, ...v.frets];
    const barreFromString =
      v.barre != null && frets[0] === -1 ? 1 : v.barre != null ? 0 : undefined;
    out[k] = {
      frets,
      barre: v.barre,
      barreFromString: barreFromString ?? v.barreFromString,
    };
  }
  return out;
}

/** Standard GCEA (reentrant), strings 4→1 left→right */
const UKULELE: Record<string, ChordShape> = {
  'C': { frets: [0,0,0,3] }, 'Cm': { frets: [0,3,3,3] }, 'C7': { frets: [0,0,0,1] }, 'Cmaj7': { frets: [0,0,0,2] },
  'Cadd9': { frets: [0,2,0,2] }, 'Csus2': { frets: [0,2,3,3] },
  'D': { frets: [2,2,2,0] }, 'Dm': { frets: [2,2,1,0] }, 'D7': { frets: [2,0,2,0] }, 'Dmaj7': { frets: [2,2,2,4] },
  'Dsus2': { frets: [2,2,0,0] }, 'Dsus4': { frets: [0,2,3,0] },
  'E': { frets: [4,4,4,2], barre:4 }, 'Em': { frets: [0,4,3,2] }, 'E7': { frets: [1,2,0,2] }, 'Emaj7': { frets: [1,3,0,2] },
  'F': { frets: [2,0,1,0] }, 'Fm': { frets: [1,0,1,3] }, 'F7': { frets: [2,3,1,3] }, 'Fmaj7': { frets: [2,4,1,0] },
  'G': { frets: [0,2,3,2] }, 'Gm': { frets: [0,2,3,1] }, 'G7': { frets: [0,2,1,2] }, 'Gmaj7': { frets: [0,2,2,2] },
  'A': { frets: [2,1,0,0] }, 'Am': { frets: [2,0,0,0] }, 'A7': { frets: [0,1,0,0] }, 'Amaj7': { frets: [1,1,0,0] },
  'Asus2': { frets: [2,4,0,0] }, 'Asus4': { frets: [2,2,0,0] },
  'B': { frets: [4,3,2,2] }, 'Bm': { frets: [4,2,2,2] },
  'B7': { frets: [2,3,2,2] }, 'Bmaj7': { frets: [4,3,3,2] },
  'Bb': { frets: [3,2,1,1], barre:1 }, 'Bbm': { frets: [3,1,1,1], barre:1 },
  'F#m': { frets: [2,1,2,0] }, 'C#m': { frets: [6,4,4,4], barre:4 }, 'G#m': { frets: [4,3,4,2] }, 'D#m': { frets: [3,3,2,1] },
  'Am7': { frets: [0,0,0,0] }, 'Em7': { frets: [0,2,0,2] }, 'Dm7': { frets: [2,2,1,3] },
  'Bm7': { frets: [2,2,2,2] }, 'Cm7': { frets: [0,3,3,3] }, 'Fm7': { frets: [1,3,1,3] },
  'A7sus4': { frets: [0,1,0,0] },
  'Adim': { frets: [2,3,2,3] }, 'Bdim': { frets: [3,2,3,2] },
  'Cdim': { frets: [3,4,3,4] }, 'Ddim': { frets: [1,2,1,2] },
  'Edim': { frets: [0,1,0,1] }, 'Fdim': { frets: [1,0,1,0] }, 'Gdim': { frets: [0,1,0,1] },
  'Caug': { frets: [1,0,0,3] }, 'Eaug': { frets: [1,0,0,2] }, 'Aaug': { frets: [2,1,0,0] },
  'Gaug': { frets: [0,3,2,1] }, 'Daug': { frets: [2,2,2,0] },
};

/** GDAE, course order low → high */
const MANDOLIN: Record<string, ChordShape> = {
  'G': { frets: [0,0,2,3] },
  'C': { frets: [0,2,3,0] }, 'D': { frets: [2,0,0,2] }, 'Dm': { frets: [2,0,3,1] },
  'A': { frets: [2,2,2,0] }, 'Am': { frets: [2,2,1,0] }, 'E': { frets: [4,4,2,0] }, 'Em': { frets: [0,4,5,0] },
  'F': { frets: [3,3,3,5] }, 'Fm': { frets: [5,5,5,8], barre:5 }, 'G7': { frets: [0,2,1,3] }, 'C7': { frets: [0,2,4,0] },
  'D7': { frets: [2,0,2,0] }, 'A7': { frets: [2,2,2,4] }, 'E7': { frets: [4,4,4,6] }, 'B': { frets: [4,4,4,2], barre:4 },
  'Bm': { frets: [4,4,2,2], barre:4 }, 'Bb': { frets: [3,3,3,1], barre:3 }, 'Bbm': { frets: [3,3,2,1], barre:3 },
  'Am7': { frets: [2,2,1,3] }, 'Dm7': { frets: [1,0,2,1] },
};

const BASS: Record<string, ChordShape> = {
  'C': { frets: [-1,3,5,5] }, 'Cm': { frets: [-1,3,5,3] }, 'C7': { frets: [-1,3,3,3] }, 'Cmaj7': { frets: [-1,3,5,4] },
  'D': { frets: [-1,0,0,2] }, 'Dm': { frets: [-1,0,0,1] }, 'D7': { frets: [-1,0,2,2] }, 'Dmaj7': { frets: [-1,0,0,2] },
  'E': { frets: [0,2,2,-1] }, 'Em': { frets: [0,2,2,-1] }, 'E7': { frets: [0,2,0,1] }, 'Emaj7': { frets: [0,2,1,-1] },
  'F': { frets: [1,3,3,-1] }, 'Fm': { frets: [1,3,3,-1] }, 'F7': { frets: [1,3,1,-1] }, 'Fmaj7': { frets: [1,3,2,-1] },
  'G': { frets: [3,5,5,-1] }, 'Gm': { frets: [3,5,3,-1] }, 'G7': { frets: [3,5,3,3] }, 'Gmaj7': { frets: [3,5,4,-1] },
  'A': { frets: [-1,0,2,2] }, 'Am': { frets: [-1,0,2,2] }, 'A7': { frets: [-1,0,2,0] }, 'Amaj7': { frets: [-1,0,2,1] },
  'B': { frets: [-1,2,4,4] }, 'Bm': { frets: [-1,2,4,2] }, 'Bb': { frets: [-1,1,3,3] }, 'Bbm': { frets: [-1,1,3,1] },
  'F#m': { frets: [2,4,4,-1] }, 'C#m': { frets: [-1,4,6,4] }, 'G#m': { frets: [4,6,4,-1] }, 'D#m': { frets: [-1,6,8,6] },
  'Am7': { frets: [-1,0,2,0] }, 'Em7': { frets: [0,2,0,-1] }, 'Dm7': { frets: [-1,0,1,1] },
};

const TABLES: Record<string, Record<string, ChordShape>> = {
  guitar6: GUITAR6,
  guitar7: buildGuitar7(),
  ukulele: UKULELE,
  mandolin: MANDOLIN,
  bass4: BASS,
};

export function listChordShapeKeys(diagramId: string): string[] {
  const t = TABLES[diagramId];
  if (!t) return [];
  return Object.keys(t);
}

export function getChordShapeTable(diagramId: string): Record<string, ChordShape> | null {
  return TABLES[diagramId] ?? null;
}

/** Direct table lookup — prefer {@link resolveChordShape} from chordShapeResolve for UI. */
export function getChordShapeExact(diagramId: string, chordName: string): ChordShape | null {
  const t = TABLES[diagramId];
  if (!t) return null;
  const key = chordName.trim();
  if (!key || key === '—' || key === '?') return null;
  return t[key] ?? null;
}

/** @deprecated Use resolveChordShape from chordShapeResolve — kept for internal table access. */
export function getChordShape(diagramId: string, chordName: string): ChordShape | null {
  return getChordShapeExact(diagramId, chordName);
}

export function getDiagramOption(diagramId: string): ChordDiagramOption | undefined {
  return CHORD_DIAGRAM_OPTIONS.find(o => o.id === diagramId);
}
