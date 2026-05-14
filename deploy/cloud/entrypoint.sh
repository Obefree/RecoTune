#!/bin/sh
set -e
cd /app

# Optional bind-mount workflow: install deps if tree is empty or forced.
if [ "$CLOUD_FORCE_NPM_CI" = "1" ] || [ ! -d node_modules/expo ]; then
  echo "[cloud] npm ci…"
  npm ci
fi

export EXPO_DEVTOOLS_LISTEN_ADDRESS="${EXPO_DEVTOOLS_LISTEN_ADDRESS:-0.0.0.0}"

PORT="${EXPO_PORT:-8081}"
echo "[cloud] Metro + tunnel on port ${PORT}"
exec npx expo start --tunnel -p "$PORT"
