# ultimate-api (RecoTune sidecar)

Flask sidecar for Ultimate Guitar tab pages. Vendored from [joncardasis/ultimate-api](https://github.com/joncardasis/ultimate-api) with a modern `js-store` parser — see [UPSTREAM.md](./UPSTREAM.md).

Used by `tools/chord-fetch/ugFetch.mjs` (search stays in Node; tab body via this API).

## Setup (once)

```powershell
cd tools\ultimate-api
py -3 -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
```

## Run

```powershell
# from tools/chord-fetch (recommended — starts proxy + API):
npm run dev-stack

# or API only:
npm run ultimate-api
```

Default: `http://127.0.0.1:5000/tab?url=<full UG tab URL>`

Env: `ULTIMATE_API_PORT`, `ULTIMATE_API_HOST`, `FLASK_DEBUG=1`

## Limitations

- **Python 3.10+** required.
- **Cloudflare** may block UG from your IP (search and tab fetch).
- **Search** is not in this API — RecoTune `ugFetch.mjs` handles search, then calls `/tab` per candidate URL.
