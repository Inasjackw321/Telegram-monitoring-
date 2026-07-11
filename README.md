# Telegram Live Monitor

A self-hosted, real-time dashboard that connects to your own Telegram account,
watches channels for new posts, auto-translates them, geolocates mentioned
places onto a live map, and streams photos/videos into a live feed — all
updated instantly via WebSockets.

It monitors:
- Every channel/group your Telegram account is already a member of (optional, on by default)
- Plus an explicit list of channels (pre-configured with the sources you gave):
  - `Middle_East_Spectator`
  - `mehrnews`
  - `naya_foriraq`
  - `Reza_Mad`
  - `final_battle313`
  - `Iranian_Militarism`
  - `Mellig`

The app auto-joins any of those that aren't already joined on your account.

## How it works

- **Backend** (`server/`): Node.js + [GramJS](https://gram.js.org/) (a Telegram
  MTProto client library) logs in as your Telegram user account and listens
  for new/edited messages in real time. Each message is translated, scanned
  for place names, and (if it has a photo/video) the media is downloaded.
  Everything is pushed to connected browsers instantly over Socket.IO.
- **Frontend** (`web/`): React + Leaflet. Shows a live map (pins for detected
  locations) side-by-side with a live-updating feed of translated posts,
  images, and videos.
- **Translation**: uses the free Google Translate endpoint by default (no API
  key required). You can optionally set `DEEPL_API_KEY` for more reliable,
  higher-volume translation.
- **Geolocation**: message text (after translation) is matched against a
  built-in gazetteer of Middle East / Iran / Iraq / Levant / Gulf place names
  in `server/src/gazetteer.json`. This is heuristic (keyword matching), not
  full NLP geocoding — easy to extend by adding more `"Place Name": [lat, lon]`
  entries to that file.

## Prerequisites

- Node.js 18 or newer
- A Telegram account (the one whose channels you want to monitor)
- A Telegram API ID + hash from <https://my.telegram.org> ("API development tools")

## Setup

1. Install dependencies (from the repo root):

   ```bash
   npm install
   ```

2. Create your `.env` file:

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and fill in `TELEGRAM_API_ID` and `TELEGRAM_API_HASH` from
   <https://my.telegram.org>.

3. Log in to Telegram (one-time, interactive):

   ```bash
   npm run login
   ```

   You'll be prompted for your phone number, the login code Telegram sends
   you, and your 2FA password if you have one set. This creates a session
   file at `server/data/session.txt`.

   **Treat that file like a password** — anyone with it has full access to
   your Telegram account. It's already excluded from git via `.gitignore`.
   Never commit it or share it.

4. Start the app in development mode (runs backend + frontend together):

   ```bash
   npm run dev
   ```

   Open <http://localhost:5173> in your browser. The backend runs on
   port 4000 (configurable via `PORT` in `.env`); the Vite dev server proxies
   API/WebSocket requests to it.

5. For a single-process production run:

   ```bash
   npm run build   # builds the React app into web/dist
   npm start       # serves the API, WebSocket, and built frontend on PORT
   ```

## Adding or changing monitored channels

Edit `server/src/sources.json` — it's a simple list:

```json
[{ "username": "some_channel" }]
```

Restart the server to pick up changes. If `INCLUDE_ALL_DIALOGS=true` (the
default, set in `.env`), every channel/group already on your account is
monitored automatically as well — the explicit list mainly matters for
channels you haven't joined yet, since the app will join them for you.

## Extending the map's place recognition

`server/src/gazetteer.json` is a plain `"Place Name": [lat, lon]` map used for
keyword-based geolocation. Add entries for any additional cities/regions you
care about — no code changes needed, just restart the server.

## Notes & limitations

- This is a personal-use tool intended to run on your own machine or a
  private server. It has no authentication of its own — don't expose it to
  the public internet without putting it behind a login/proxy, since it
  streams live content from your Telegram account.
- The free translation endpoint may rate-limit under heavy traffic; set
  `DEEPL_API_KEY` in `.env` if you need something more robust.
- Geolocation is keyword-based, not true NLP — it will miss unlisted places
  and can't disambiguate identically-named places in different countries.
- Only photos and videos are downloaded and shown in the feed; other
  attachments (audio, generic files) are skipped to keep the feed focused on
  visual media.
