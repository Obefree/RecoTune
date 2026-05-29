from urllib.parse import urlparse

from flask import jsonify, request

from server import app
from server.tab_parser import dict_from_ultimate_tab

SUPPORTED_UG_HOSTS = frozenset({'tabs.ultimate-guitar.com', 'www.ultimate-guitar.com'})


@app.route('/')
def index():
    return jsonify({'ok': True, 'service': 'ultimate-api', 'endpoints': ['/tab?url=...']})


@app.route('/health')
def health():
    return jsonify({'ok': True})


@app.route('/tab')
def tab():
    ultimate_url = request.args.get('url')
    if not ultimate_url:
        return jsonify({'error': 'missing url parameter'}), 400
    try:
        parsed_url = urlparse(ultimate_url)
        if parsed_url.netloc not in SUPPORTED_UG_HOSTS:
            raise ValueError('unsupported url host — use tabs.ultimate-guitar.com')
    except Exception as e:
        return jsonify({'error': str(e)}), 400

    try:
        tab_dict = dict_from_ultimate_tab(ultimate_url)
        return jsonify(tab_dict)
    except RuntimeError as e:
        return jsonify({'error': str(e)}), 503
    except Exception as e:
        return jsonify({'error': str(e)}), 500
