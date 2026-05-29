"""Modern Ultimate Guitar tab parse (js-store / wiki_tab). Used when legacy <pre> is absent."""

import html as html_lib
import json
import re

import requests
from bs4 import BeautifulSoup

UG_FETCH_UA = (
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
    '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
)


def _decode_html(s: str) -> str:
    s = html_lib.unescape(s or '')
    return (
        s.replace('&nbsp;', ' ')
        .replace('&amp;', '&')
        .replace('&lt;', '<')
        .replace('&gt;', '>')
        .replace('&quot;', '"')
        .replace('&#39;', "'")
    )


def is_cloudflare_html(text: str) -> bool:
    return bool(re.search(r'Just a moment|cf-browser-verification|challenge-platform', text, re.I))


def _parse_js_store(page_html: str):
    soup = BeautifulSoup(page_html, 'html.parser')
    raw = None
    el = soup.select_one('.js-store')
    if el and el.get('data-content'):
        raw = el['data-content']
    if not raw:
        for candidate in soup.select('[data-content]'):
            dc = candidate.get('data-content') or ''
            if '"store"' in dc and '"page"' in dc:
                raw = dc
                break
    if not raw or not raw.strip():
        return None
    try:
        return json.loads(_decode_html(raw))
    except json.JSONDecodeError:
        return None


def wiki_content_to_lines(raw: str) -> list:
    if not (raw or '').strip():
        return []
    text = _decode_html(raw)
    text = re.sub(r'\[(?:ch|tab)\]([^\[]+?)\[/(?:ch|tab)\]', r'[\1]', text, flags=re.I)
    text = re.sub(r'</?[^>]+>', '', text)
    lines = []
    for line in text.split('\n'):
        lines.append(line.replace('\r', '').rstrip())
    return [ln for ln in lines if ln.strip()]


def fetch_tab_dict(url: str) -> dict:
    res = requests.get(
        url,
        headers={
            'User-Agent': UG_FETCH_UA,
            'Accept': 'text/html,application/xhtml+xml',
            'Accept-Language': 'en-US,en;q=0.9',
        },
        timeout=45,
    )
    text = res.text
    if res.status_code in (403, 503) or is_cloudflare_html(text):
        raise RuntimeError('Ultimate Guitar blocked the request (Cloudflare).')
    if not res.ok:
        raise RuntimeError(f'HTTP {res.status_code}')

    store = _parse_js_store(text)
    if not store:
        raise ValueError('js-store not found on tab page')

    tab_view = (store.get('store') or {}).get('page', {}).get('data', {}).get('tab_view') or {}
    wiki = (tab_view.get('wiki_tab') or {}).get('content') or (tab_view.get('wikiTab') or {}).get('content')
    raw_content = wiki or (tab_view.get('tab') or {}).get('content')
    if not (raw_content or '').strip():
        raise ValueError('No wiki tab content on page')

    content_lines = wiki_content_to_lines(raw_content)
    if len(content_lines) < 2:
        raise ValueError('Tab content too short')

    page_data = (store.get('store') or {}).get('page', {}).get('data', {}) or {}
    tab_meta = page_data.get('tab') or {}
    song_name = (
        tab_view.get('song_name')
        or (tab_view.get('song') or {}).get('name')
        or tab_meta.get('song_name')
        or 'UNKNOWN'
    )
    artist_name = (
        tab_view.get('artist_name')
        or (tab_view.get('artist') or {}).get('name')
        or tab_meta.get('artist_name')
        or 'UNKNOWN'
    )

    return {
        'tab': {
            'title': str(song_name).strip(),
            'artist_name': str(artist_name).strip(),
            'author': 'Ultimate Guitar',
            'content_lines': content_lines,
            'parser': 'js-store',
        }
    }
