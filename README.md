# Telegram Live Monitor

A real-time dashboard that connects to your own Telegram account, watches
channels for new posts, auto-translates them, and streams them — with any
photos/videos — into a live timeline, updated instantly.

There are **two independent implementations of the same app** in this repo —
pick whichever suits you (or run both, they use separate ports/sessions):

| | `server/` + `web/` | `python-app/` |
|---|---|---|
| Stack | Node.js (GramJS) + React/Vite frontend | Python (Telethon) + Flask, no build step |
| View | Map + timeline feed side by side | Just the timeline, full width |
| How you run it | `npm run dev`, open a browser tab | Double-click a launcher file — it asks for your API keys itself |
| Best for | Tinkering with the React UI / wanting the map | The simplest possible way to just get it running |

Both monitor:
- Every channel/group your Telegram account is already a member of (optional, on by default)
- Plus an explicit list of channels (pre-configured with the sources you gave),
  shared between both apps in `shared/sources.json`:
  - `Middle_East_Spectator`
  - `mehrnews`
  - `naya_foriraq`
  - `Reza_Mad`
  - `final_battle313`
  - `Iranian_Militarism`
  - `Mellig`

Both auto-join any of those that aren't already joined on your account, and
both use the same geolocation gazetteer (`shared/gazetteer.json`, used to tag
each message with a place name) and the same translation strategy (free
Google Translate endpoint by default, optional DeepL key for reliability).

## Prerequisites (either app)

- A Telegram account (the one whose channels you want to monitor)
- A Telegram API ID + hash from <https://my.telegram.org> ("API development tools")
  — the Python app will ask you for these itself on first run and save them;
  for the Node app, copy `.env.example` to `.env` and fill them in yourself.

---

## Option A: Python desktop app (`python-app/`)

The simplest way to run this — one command, opens its own window, no Node.js
or build step required.

**Prerequisites:** Python 3.9+.

On **Linux only**, `pywebview` (the library that opens the desktop window)
needs a system GUI backend, since pip can't install these:
```bash
sudo apt install python3-gi gir1.2-webkit2-4.0   # GTK backend (recommended), OR
pip install pyqt5 pyqtwebengine qtpy              # Qt backend
```
Windows and macOS work out of the box — Windows uses the built-in Edge
WebView2 runtime, macOS uses the built-in WebKit. If no desktop window
backend is available for any reason, the app doesn't crash — it prints a
message, opens the dashboard in your default browser instead, and keeps
running there. Either way you get the same live timeline.

**Setup — just double-click a file, no terminal needed:**

- **Windows:** double-click `python-app/Start Telegram Monitor.bat`
- **macOS:** double-click `python-app/Start Telegram Monitor.command`
  (if macOS blocks it as an unidentified script, right-click it and choose
  "Open" once to approve it)
- **Linux:** double-click `python-app/start-telegram-monitor.sh` in your file
  manager and choose "Run" if prompted (or run `./start-telegram-monitor.sh`
  from a terminal)

Each of these opens a console window, creates a `.venv` and installs
dependencies automatically the first time (takes a minute or two), then
launches the app. On later runs it skips straight to launching. You can
still do this manually if you prefer:

```bash
cd python-app
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

On first run, **check that console window** — it'll ask you two things,
one after the other, right there in the console:

1. Your Telegram **api_id** and **api_hash** (from <https://my.telegram.org>).
   It saves these to `.env` at the repo root so you're never asked again on
   this computer.
2. Your Telegram account login: phone number, the code Telegram sends you,
   and your 2FA password if you have one. This creates a session file
   (`python-app/data/session.session`) and won't ask again either.

Once connected, a window titled "Telegram Live Monitor" opens automatically
with the live timeline. Just run the launcher again next time — no prompts.

**Treat `python-app/data/session.session` like a password** — anyone with it
has full access to your Telegram account. It's excluded from git.

---

## Option B: Node.js + React app (`server/` + `web/`)

1. Install dependencies (from the repo root):

   ```bash
   npm install
   ```

2. Log in to Telegram (one-time, interactive):

   ```bash
   npm run login
   ```

   You'll be prompted for your phone number, login code, and 2FA password.
   This creates a session file at `server/data/session.txt` — **treat it like
   a password**, it's excluded from git.

3. Start the app in development mode (runs backend + frontend together):

   ```bash
   npm run dev
   ```

   Open <http://localhost:5173> in your browser. The backend runs on
   port 4000 (configurable via `PORT` in `.env`); the Vite dev server proxies
   API/WebSocket requests to it.

4. For a single-process production run:

   ```bash
   npm run build   # builds the React app into web/dist
   npm start       # serves the API, WebSocket, and built frontend on PORT
   ```

---

## How it works (both apps)

- **Telegram connection**: logs in as your own Telegram user account (not a
  bot) via the MTProto protocol — GramJS in Node, Telethon in Python — so it
  can see every chat/channel you're a member of, plus join new ones from the
  configured source list. New/edited messages are handled the instant they arrive.
- **Translation**: `translate.js` / `translator.py` try DeepL first (if you
  set `DEEPL_API_KEY`), otherwise fall back to the free, keyless Google
  Translate endpoint.
- **Geolocation**: translated message text is matched against
  `shared/gazetteer.json`, a `"Place Name": [lat, lon]` map covering
  Iran/Iraq/Syria/Lebanon/Israel-Palestine/Yemen/Gulf/Turkey/Afghanistan/
  Pakistan. Each message gets tagged with any place names found (shown as a
  📍 label in the timeline card, and additionally plotted as a pin on the map
  in the Node app). This is heuristic keyword matching, not full NLP geocoding.
- **Media**: photos/videos are downloaded and served from a local `media/`
  folder and shown inline in the feed. Other attachment types (audio,
  generic documents) are skipped to keep things focused on visual media.
- **Realtime updates**: Socket.IO pushes every new/edited message to the open
  browser tab or desktop window the moment it's processed — no polling. The
  timeline groups everything by day (Today / Yesterday / date) with a
  connecting line, newest first.

## Adding or changing monitored channels

Edit `shared/sources.json` (used by both apps) — it's a simple list:

```json
[{ "username": "some_channel" }]
```

Restart whichever app you're running to pick up changes. If
`INCLUDE_ALL_DIALOGS=true` (the default, set in `.env`), every channel/group
already on your account is monitored automatically as well — the explicit
list mainly matters for channels you haven't joined yet, since the app will
join them for you.

## Extending place recognition

`shared/gazetteer.json` is a plain `"Place Name": [lat, lon]` map used for
keyword-based geolocation, shared by both apps. Add entries for any additional
cities/regions you care about — no code changes needed, just restart.

## Notes & limitations

- Personal-use tools intended to run on your own machine. Neither has its own
  authentication — don't expose either one to the public internet without
  putting it behind a login/proxy, since both stream live content from your
  Telegram account.
- The free translation endpoint may rate-limit under heavy traffic; set
  `DEEPL_API_KEY` in `.env` if you need something more robust.
- Geolocation is keyword-based, not true NLP — it will miss unlisted places
  and can't disambiguate identically-named places in different countries.
- The two apps keep separate login sessions and separate ports
  (`PORT`/`TELEGRAM_SESSION_FILE`/`MEDIA_DIR` for Node,
  `PY_PORT`/`PY_SESSION_FILE`/`PY_MEDIA_DIR` for Python) so you can run either
  one independently, or both at once, without conflicts.
