#!/bin/bash
# Token Guard Daemon — Install/Uninstall Script
# Usage: ./daemon.sh install | uninstall | status

set -e

PLIST_NAME="com.ripio.token-guard"
PLIST_SRC="$(cd "$(dirname "$0")" && pwd)/$PLIST_NAME.plist"
PLIST_DST="$HOME/Library/LaunchAgents/$PLIST_NAME.plist"
INDEX_PATH="$(cd "$(dirname "$0")" && pwd)/src/index.ts"

case "${1:-status}" in
  install)
    echo "📦 Installing Token Guard daemon..."
    # Generate plist with real paths
    sed -e "s|__DASHBOARD_INDEX_PATH__|$INDEX_PATH|g" \
        -e "s|__HOME__|$HOME|g" \
        "$PLIST_SRC" > "$PLIST_DST"
    launchctl load "$PLIST_DST"
    echo "✅ Daemon installed and started!"
    echo "   Dashboard: http://localhost:3000"
    echo "   Logs: ~/.token-guard.log"
    echo "   Stop: ./daemon.sh uninstall"
    ;;
  uninstall)
    echo "🗑️  Removing Token Guard daemon..."
    launchctl unload "$PLIST_DST" 2>/dev/null || true
    rm -f "$PLIST_DST"
    echo "✅ Daemon removed."
    ;;
  status)
    if launchctl list | grep -q "$PLIST_NAME"; then
      echo "✅ Token Guard daemon is RUNNING"
      echo "   Dashboard: http://localhost:3000"
    else
      echo "⏹️  Token Guard daemon is NOT running"
      echo "   Install: ./daemon.sh install"
    fi
    ;;
  *)
    echo "Usage: $0 {install|uninstall|status}"
    exit 1
    ;;
esac
