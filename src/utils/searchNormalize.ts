/** Query/field normalization for smart song search (typos, mixed RU/EN layout). */

const CYR_TO_LAT: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
  и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

/** Lowercase, strip accents/punctuation, optional Cyrillic→Latin for fuzzy cross-script match. */
export function normalizeSearchText(s: string, transliterate = true): string {
  let t = s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[''`]/g, '')
    .replace(/[^a-z0-9а-яё\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (transliterate && /[а-яё]/.test(t)) {
    t = t
      .split('')
      .map(ch => CYR_TO_LAT[ch] ?? ch)
      .join('');
  }
  return t;
}

export function tokenizeQuery(query: string): string[] {
  const n = normalizeSearchText(query);
  if (!n) return [];
  return n.split(/\s+/).filter(t => t.length >= 1);
}

export function combinedArtistTitle(artist: string, title: string): string {
  return normalizeSearchText(`${artist} ${title}`);
}

/** Latin (translit) + Cyrillic forms for cross-script substring match. */
export function searchQueryForms(query: string): { latin: string; native: string } {
  const trimmed = query.trim();
  return {
    latin: normalizeSearchText(trimmed, true),
    native: normalizeSearchText(trimmed, false),
  };
}

export function blobMatchesQuery(blob: string, forms: { latin: string; native: string }): boolean {
  if (!blob) return false;
  const latinBlob = normalizeSearchText(blob, true);
  const nativeBlob = normalizeSearchText(blob, false);
  if (forms.latin.length >= 2 && latinBlob.includes(forms.latin)) return true;
  if (forms.native.length >= 2 && nativeBlob.includes(forms.native)) return true;
  return false;
}
