# Upstream

Vendored from [joncardasis/ultimate-api](https://github.com/joncardasis/ultimate-api) (MIT-style academic project).

RecoTune changes:

- Modern Ultimate Guitar `js-store` / `wiki_tab` parse (`server/ug_modern.py`) — upstream HTML `<pre class="js-tab-content">` often fails on current UG pages.
- Flask 2.x+ / Python 3.10+ `requirements.txt` for Windows dev.
- `run.py` binds `127.0.0.1` and respects `ULTIMATE_API_PORT`.

API contract unchanged: `GET /tab?url=<full tabs.ultimate-guitar.com URL>` → JSON `{ "tab": { ... } }`.
