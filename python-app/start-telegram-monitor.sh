#!/bin/bash
# Double-click this file in your file manager (choose "Run" if prompted),
# or run it from a terminal with ./start-telegram-monitor.sh
set -e
cd "$(dirname "$0")"

if [ ! -x ".venv/bin/python3" ]; then
  echo "Setting up Telegram Live Monitor for the first time - this can take a minute..."
  python3 -m venv .venv
  ".venv/bin/pip" install --upgrade pip >/dev/null
  ".venv/bin/pip" install -r requirements.txt
  echo "Setup complete."

  if ! ".venv/bin/python3" -c "import gi" 2>/dev/null && ! ".venv/bin/python3" -c "import PyQt5" 2>/dev/null; then
    echo
    echo "Note: no GTK or Qt found, so the desktop window may fail to open."
    echo "Install one of these, then run this script again:"
    echo "    sudo apt install python3-gi gir1.2-webkit2-4.0     (GTK, recommended)"
    echo "    .venv/bin/pip install pyqt5 pyqtwebengine qtpy      (Qt)"
  fi
  echo
fi

echo "Starting Telegram Live Monitor..."
echo "(First run ever: watch here for a Telegram login prompt - phone number, code, 2FA password.)"
echo
".venv/bin/python3" app.py

echo
read -r -p "Press Enter to close this window..."
