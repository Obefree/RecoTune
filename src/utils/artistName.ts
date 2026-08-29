/** Canonical artist label for catalog grouping (Кино (Виктор Цой) → Кино). */
export function canonicalizeArtist(raw: string): { name: string; key: string } {
  let name = String(raw ?? '').replace(/\s+/g, ' ').trim();
  name = name.replace(/\s*[(\[]\s*(?:feat\.?|ft\.?|featuring)\b[^)\]]*[)\]]\s*$/i, '').trim();
  name = name.replace(/\s*\([^)]{1,50}\)\s*$/g, '').trim();
  name = name.replace(/\s*\[[^\]]{1,50}\]\s*$/g, '').trim();
  if (!name) name = 'Неизвестный';
  const key = name.toLowerCase().replace(/ё/g, 'е');
  return { name, key };
}
