# Always-on Expo dev server (cloud / VPS)

Runs **Metro + Expo tunnel** in Docker with **`restart: unless-stopped`**, so the process comes back after a host reboot. Use **Expo Go** on phones/tablets; they connect through the tunnel, not your LAN.

## Limits (be explicit)

- The **`exp://…*.exp.direct`** host can still **change when the tunnel process restarts** (container rebuild, ngrok session expiry, Expo/ngrok outages). For a **fixed hostname** you need **ngrok reserved domain** (paid) or a different architecture (**EAS Update** + dev/store build), not plain `expo start`.
- This is a **development server**, not an App Store release.

## Requirements

- Any Linux host with Docker (VPS, EC2, Hetzner, home server, etc.).
- Free **ngrok authtoken** recommended: [ngrok dashboard](https://dashboard.ngrok.com/get-started/your-authtoken) → set `NGROK_AUTHTOKEN` below.

## Quick start

From the **repository root**:

```bash
cp deploy/cloud/env.example .env.cloud
# edit .env.cloud — set NGROK_AUTHTOKEN

docker compose --env-file .env.cloud -f deploy/cloud/docker-compose.yml up -d --build
```

Wait until logs show `Tunnel ready` (first start often **~1–2 minutes**).

### Get the Expo Go URL

```bash
docker compose --env-file .env.cloud -f deploy/cloud/docker-compose.yml exec expo-cloud \
  sh -c 'EXPO_PORT=8081 node /app/scripts/print-expo-go-url.mjs'
```

Paste the printed `exp://…` into Expo Go (Enter URL manually) or generate a QR from that string.

### Logs

```bash
docker compose --env-file .env.cloud -f deploy/cloud/docker-compose.yml logs -f expo-cloud
```

## Update app code on the server

Rebuild and restart after `git pull`:

```bash
git pull
docker compose --env-file .env.cloud -f deploy/cloud/docker-compose.yml up -d --build
```

## Live bind mount (optional, advanced)

To edit files on the host and hot-reload without rebuilding the image, extend `docker-compose.yml` with a volume mapping of the repo into `/app` and a named volume for `node_modules`; on first start set `CLOUD_FORCE_NPM_CI=1` once so dependencies exist inside the container.
