/** Group key: A-ha / Aha / A ha, Guns N' Roses / Guns N Roses, The Beatles / Beatles. */
export function artistGroupKey(name: string): string {
  let k = name
    .toLowerCase()
    .replace(/ё/g, 'е')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9а-я]+/g, '');
  if (k.startsWith('the') && k.length > 6) k = k.slice(3);
  return k || name.toLowerCase();
}

/** Prefer "A-ha" / "Guns N' Roses" over flattened spellings when merging. */
export function preferArtistLabel(candidate: string, current: string): boolean {
  const score = (s: string) => (/[-'’&./]/.test(s) ? 2 : 0) + Math.min(s.length, 40) / 40;
  return score(candidate) > score(current);
}

/** Canonical artist label for catalog grouping (Кино (Виктор Цой) → Кино). */
export function canonicalizeArtist(raw: string): { name: string; key: string } {
  let name = String(raw ?? '').replace(/\s+/g, ' ').trim();
  name = name.replace(/\s*[(\[]\s*(?:feat\.?|ft\.?|featuring)\b[^)\]]*[)\]]\s*$/i, '').trim();
  name = name.replace(/\s*\([^)]{1,50}\)\s*$/g, '').trim();
  name = name.replace(/\s*\[[^\]]{1,50}\]\s*$/g, '').trim();
  if (!name) name = 'Unknown';
  return { name, key: artistGroupKey(name) };
}

/** Latin titles first, then other scripts, Cyrillic last. English is the catalog language. */
export function compareCatalogLabel(a: string, b: string): number {
  const rank = (s: string) => {
    const c = (s.trim().codePointAt(0) ?? 0);
    if ((c >= 65 && c <= 90) || (c >= 97 && c <= 122)) return 0;
    if (c >= 0x0400 && c <= 0x04FF) return 2;
    return 1;
  };
  const d = rank(a) - rank(b);
  if (d !== 0) return d;
  return a.localeCompare(b, 'en', { sensitivity: 'base' });
}
