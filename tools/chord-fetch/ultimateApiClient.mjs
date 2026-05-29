/**
 * HTTP client for vendored tools/ultimate-api (joncardasis/ultimate-api contract).
 * Search stays in ugFetch.mjs; tab body via GET /tab?url=...
 */

const DEFAULT_BASE = 'http://127.0.0.1:5000';

export function getUltimateApiBase() {
  const raw = (process.env.ULTIMATE_API_URL ?? DEFAULT_BASE).trim().replace(/\/$/, '');
  return raw || DEFAULT_BASE;
}

/** @param {{ note?: string, pre_spaces?: number }}[] chords */
export function ultimateApiStructuredLinesToText(chords) {
  let line = '';
  for (const c of chords ?? []) {
    const spaces = Math.max(0, Number(c.pre_spaces ?? 0));
    line += ' '.repeat(spaces) + String(c.note ?? '');
  }
  return line.trimEnd();
}

/**
 * @param {Record<string, unknown>} tab — `data.tab` from ultimate-api
 * @returns {string[]}
 */
export function tabPayloadToLines(tab) {
  if (Array.isArray(tab.content_lines) && tab.content_lines.length) {
    return tab.content_lines.map(l => String(l).replace(/\r/g, '').trimEnd()).filter(l => l.trim());
  }

  const out = [];
  for (const row of tab.lines ?? []) {
    const type = row?.type;
    if (type === 'blank') {
      out.push('');
      continue;
    }
    if (type === 'lyric' || row.lyric != null) {
      out.push(String(row.lyric ?? '').replace(/\r/g, '').trimEnd());
      continue;
    }
    if (type === 'chords' || row.chords) {
      const text = ultimateApiStructuredLinesToText(row.chords);
      if (text.trim()) out.push(text);
    }
  }
  return out.filter(l => l.trim());
}

/**
 * @param {string} tabUrl — full tabs.ultimate-guitar.com URL
 * @returns {Promise<{ ok: true, tab: Record<string, unknown> } | { ok: false, code: string, error: string }>}
 */
export async function fetchUltimateApiTab(tabUrl) {
  const base = getUltimateApiBase();
  const endpoint = `${base}/tab?url=${encodeURIComponent(tabUrl)}`;

  let res;
  try {
    res = await fetch(endpoint, { headers: { Accept: 'application/json' } });
  } catch (e) {
    const msg = e?.cause?.code === 'ECONNREFUSED' || e?.code === 'ECONNREFUSED'
      ? 'ultimate-api не запущен (npm run dev-stack или npm run ultimate-api).'
      : `ultimate-api: ${e?.message ?? 'network'}`;
    return { ok: false, code: 'ultimate_api_down', error: msg };
  }

  let body;
  try {
    body = await res.json();
  } catch {
    return { ok: false, code: 'bad_json', error: 'ultimate-api вернул не JSON.' };
  }

  if (!res.ok) {
    const err = String(body?.error ?? `HTTP ${res.status}`);
    const code = res.status === 503 ? 'blocked' : 'ultimate_api_error';
    return { ok: false, code, error: err };
  }

  const tab = body?.tab ?? body;
  if (!tab || typeof tab !== 'object') {
    return { ok: false, code: 'no_tab', error: 'ultimate-api: пустой ответ.' };
  }

  return { ok: true, tab };
}
