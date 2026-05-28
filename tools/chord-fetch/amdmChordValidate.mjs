/**
 * ChordPro body validation for AmDm parse (aligned with app isVerifiedChordProLyrics).
 */

/** Matches [G], [Am], [Gsus4], [A7/C#] — aligned with app songContent.ts */
const CHORD_MARKER_RE = /\[[A-G][#b♯♭\d]*(?:\/[A-G][#b♯♭\d]*)?[^\]]*\]/i;
const CHORD_TOKEN_RE = /^[A-G](?:#|b|♯|♭)?(?:maj7|maj|min|m(?!aj)|dim|aug|sus2|sus4|sus|add\d+|m7|7|9|11|13|6|\d+)?(?:\/[A-G](?:#|b|♯|♭)?)?$/i;

export const AMDM_MIN_BODY_LINES = 4;
export const AMDM_MIN_CHORD_LINES = 2;
export const AMDM_MIN_LYRIC_LINES = 2;

function lineIsChordOnly(line) {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return false;
  return tokens.every(t => {
    const bare = t.replace(/^\[|\]$/g, '');
    return CHORD_TOKEN_RE.test(bare);
  });
}

function lineHasLyricWords(line) {
  const prose = line.replace(/\[[^\]]+\]/g, ' ').replace(/\s+/g, ' ');
  return /[a-zA-Zа-яА-ЯёЁ]{2,}/.test(prose);
}

function lineHasChordMarkers(line) {
  return CHORD_MARKER_RE.test(line);
}

/**
 * @param {string[]} lines — ChordPro body lines (no {directives})
 * @returns {{ ok: true } | { ok: false, code: string, message: string }}
 */
export function validateAmdmChordLines(lines) {
  const body = lines.map(l => l.trim()).filter(Boolean);
  if (body.length < 2) {
    return {
      ok: false,
      code: 'too_short',
      message: 'На странице слишком мало строк — возможно не тот подбор.',
    };
  }

  let chordLines = 0;
  let lyricLines = 0;
  for (const line of body) {
    if (lineHasChordMarkers(line)) chordLines++;
    if (lineHasLyricWords(line)) lyricLines++;
  }

  if (body.every(lineIsChordOnly)) {
    return {
      ok: false,
      code: 'progression_only',
      message: 'Найдена только прогрессия без текста — нужен полный подбор с AmDm.',
    };
  }

  if (chordLines < AMDM_MIN_CHORD_LINES) {
    return {
      ok: false,
      code: 'no_chords',
      message: 'Нет построчных аккордов — страница без таба или неверный разбор.',
    };
  }

  if (lyricLines < AMDM_MIN_LYRIC_LINES) {
    return {
      ok: false,
      code: 'no_lyrics',
      message: 'Найдено на AmDm, но без текста песни — попробуйте другое написание.',
    };
  }

  if (body.length < AMDM_MIN_BODY_LINES && lyricLines < 3) {
    return {
      ok: false,
      code: 'too_short',
      message: 'Таб слишком короткий — проверьте исполнителя и название.',
    };
  }

  return { ok: true };
}

export function preHtmlChordSignal(html) {
  const chordDivs = (html.match(/podbor__chord/gi) || []).length;
  return chordDivs;
}
