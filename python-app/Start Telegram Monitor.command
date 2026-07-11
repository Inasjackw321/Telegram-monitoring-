#!/bin/bash
# Double-click this file in Finder to set up (first run only) and launch the app.
# If macOS refuses to open it, right-click -> Open once to approve it.
set -e
cd "$(dirname "$0")"

if [ ! -x ".venv/bin/python3" ]; then
  echo "Setting up Telegram Live Monitor for the first time - this can take a minute..."
  python3 -m venv .venv
  ".venv/bin/pip" install --upgrade pip >/dev/null
  ".venv/bin/pip" install -r requirements.txt
  echo "Setup complete."
  echo
fi

echo "Starting Telegram Live Monitor..."
echo "(First run ever: watch here for a Telegram login prompt - phone number, code, 2FA password.)"
echo
".venv/bin/python3" app.py

echo
read -r -p "Press Enter to close this window..."
