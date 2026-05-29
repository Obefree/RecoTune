import os

from server import app

if __name__ == '__main__':
    host = os.environ.get('ULTIMATE_API_HOST', '127.0.0.1')
    port = int(os.environ.get('ULTIMATE_API_PORT', '5000'))
    debug = os.environ.get('FLASK_DEBUG', '') in ('1', 'true', 'yes')
    app.run(host=host, port=port, debug=debug)
