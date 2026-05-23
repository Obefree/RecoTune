/** RU JCUKEN ↔ QWERTY when the user typed on the wrong keyboard layout. */

const LATIN_TO_CYRILLIC: Record<string, string> = {
  q: 'й',
  w: 'ц',
  e: 'у',
  r: 'к',
  t: 'е',
  y: 'н',
  u: 'г',
  i: 'ш',
  o: 'щ',
  p: 'з',
  '[': 'х',
  ']': 'ъ',
  a: 'ф',
  s: 'ы',
  d: 'в',
  f: 'а',
  g: 'п',
  h: 'р',
  j: 'о',
  k: 'л',
  l: 'д',
  ';': 'ж',
  "'": 'э',
  z: 'я',
  x: 'ч',
  c: 'с',
  v: 'м',
  b: 'и',
  n: 'т',
  m: 'ь',
  ',': 'б',
  '.': 'ю',
  '`': 'ё',
};

const CYRILLIC_TO_LATIN = Object.fromEntries(
  Object.entries(LATIN_TO_CYRILLIC).map(([lat, cyr]) => [cyr, lat]),
) as Record<string, string>;

function swapByMap(input: string, map: Record<string, string>): string {
  return input
    .split('')
    .map(ch => {
      const lower = ch.toLowerCase();
      const mapped = map[lower];
      if (!mapped) return ch;
      return ch === lower ? mapped : mapped.toUpperCase();
    })
    .join('');
}

/** Latin keys typed while Russian layout was intended (e.g. `rbjy` → `кино`). */
export function swapKeyboardLayoutEnToRu(input: string): string {
  return swapByMap(input, LATIN_TO_CYRILLIC);
}

/** Cyrillic typed while English layout was intended. */
export function swapKeyboardLayoutRuToEn(input: string): string {
  return swapByMap(input, CYRILLIC_TO_LATIN);
}
