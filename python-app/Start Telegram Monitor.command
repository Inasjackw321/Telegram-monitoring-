#!/bin/bash
# Double-click this file in Finder to set up (first run only) and launch the app.
# If macOS refuses to open it, right-click -> Open once to approve it.
cd "$(dirname "$0")"

fail() {
  echo
  echo "ERROR: $1"
  echo
  read -r -p "Press Enter to close this window..."
  exit 1
}

if [ ! -x ".venv/bin/python3" ]; then
  echo "Setting up Telegram Live Monitor for the first time - this can take a minute..."
  python3 -m venv .venv || fail "Could not create a virtual environment. Make sure Python 3.9+ is installed (try running 'python3 --version' in Terminal)."
  ".venv/bin/pip" install --upgrade pip >/dev/null 2>&1
  ".venv/bin/pip" install -r requirements.txt || fail "Failed to install dependencies. See the error above."
  echo "Setup complete."
  echo
fi

echo "Starting Telegram Live Monitor..."
echo "(First run ever: watch here for a Telegram login prompt - phone number, code, 2FA password.)"
echo
".venv/bin/python3" app.py
APP_EXIT=$?

if [ "$APP_EXIT" -ne 0 ]; then
  echo
  echo "The app exited with an error (see above)."
fi

echo
read -r -p "Press Enter to close this window..."
