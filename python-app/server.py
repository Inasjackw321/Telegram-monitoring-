import json

from flask import Flask, jsonify, render_template, request, send_from_directory
from flask_socketio import SocketIO

import config
import message_store

with open(config.SOURCES_FILE, 'r', encoding='utf-8') as f:
    SOURCES = json.load(f)

app = Flask(__name__, static_folder='static', template_folder='templates')
socketio = SocketIO(app, cors_allowed_origins='*', async_mode='threading')


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/messages')
def api_messages():
    limit = min(int(request.args.get('limit', 200)), 1000)
    return jsonify(message_store.get_recent(limit))


@app.route('/api/sources')
def api_sources():
    return jsonify(SOURCES)


@app.route('/media/<path:filename>')
def media(filename):
    return send_from_directory(config.MEDIA_DIR, filename)


@socketio.on('connect')
def handle_connect():
    socketio.emit('bootstrap', message_store.get_recent(200))


def emit_message(payload, is_edit=False):
    """Thread-safe: called from the Telethon background thread."""
    socketio.emit('messageUpdate' if is_edit else 'message', payload)


def run_server():
    # allow_unsafe_werkzeug is fine here: this only ever binds to 127.0.0.1
    # for a single local user, not a public-facing deployment.
    socketio.run(app, host='127.0.0.1', port=config.PORT, debug=False, use_reloader=False, allow_unsafe_werkzeug=True)
