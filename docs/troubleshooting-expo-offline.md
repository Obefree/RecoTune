# Expo Metro: offline mode (fetch failed)

## Symptom

Starting Metro shows:

```
warning: Bundler cache is empty, rebuilding
TypeError: fetch failed
    at getNativeModuleVersionsAsync ...
```

Then `Expo exited.` — often from **RecoTune.bat** on the Desktop.

## Cause

Expo CLI calls **expo.dev** during startup to validate native module versions. That step needs internet; **firewall, VPN, corporate proxy, or DNS** can block it. Local JS bundling does not require that API.

## Fix (recommended)

1. **Desktop shortcut:** use updated `RecoTune.bat` — it sets `EXPO_OFFLINE=1` and runs:
   `npx expo start --offline -c --port 8088`
2. **From repo:**
   ```bash
   npm run start:offline
   ```
   or:
   ```bash
   npx expo start --offline -c --port 8088
   ```

Optional env (same effect as `--offline`):

- `EXPO_OFFLINE=1`
- `EXPO_NO_TELEMETRY=1` (disables telemetry only; does not fix fetch by itself)

## Online mode

When network is fine and you want Expo’s online checks:

```bash
npm run start
```

Default port in scripts is 8081; **RecoTune.bat uses 8088** so Expo Go does not stick to an old Metro on 8081.

## Harmless for local dev?

Yes. **Offline start skips the remote version check**; Metro still bundles your app from `src/`. You only miss optional online warnings about SDK/native module mismatches until you run without `--offline` on a working network.
