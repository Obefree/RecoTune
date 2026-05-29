import requests

from .parser import html_tab_to_json_dict
from .ug_modern import fetch_tab_dict, is_cloudflare_html

UG_TAGS = ['js-tab-content', 'js-copy-content']


def dict_from_ultimate_tab(url: str) -> dict:
    try:
        return fetch_tab_dict(url)
    except RuntimeError:
        raise
    except ValueError:
        pass

    html = requests.get(url, timeout=45).content
    if is_cloudflare_html(html.decode('utf-8', errors='replace')):
        raise RuntimeError('Ultimate Guitar blocked the request (Cloudflare).')
    return html_tab_to_json_dict(html, UG_TAGS)
