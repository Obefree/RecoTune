from flask import Flask

app = Flask(__name__)

import server.views  # noqa: E402,F401
