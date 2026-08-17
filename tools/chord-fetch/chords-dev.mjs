#!/usr/bin/env node
/**
 * Ensures chord-fetch proxy (:8787) is running. UG Flask (:5000) is optional.
 * Safe as RecoTune.bat / npm start pre-hook.
 */
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import { execSync, spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PROXY_PORT = Number(process.env.CHORD_FETCH_PORT || 8787);
const ULTIMATE_PORT = Number(process.env.ULTIMATE_API_PORT || 5000);
const WAIT_MS = Number(process.env.CHORDS_DEV_WAIT_MS || 25_000);
const POLL_MS = 400;

const here = path.dirname(fileURLToPath(import.meta.url));

function isPortOpen(port, host = '127.0.0.1') {
  return new Promise(resolve => {
    const socket = net.createConnection({ port, host }, () => {
      socket.end();
      resolve(true);
    });
    socket.on('error', () => resolve(false));
    socket.setTimeout(900, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function waitForPort(port, label, waitMs = WAIT_MS) {
  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    if (await isPortOpen(port)) {
      console.log(`[chords:dev] ${label} ready on :${port}`);
      return true;
    }
    await sleep(POLL_MS);
  }
  return false;
}

function killListeningPort(port) {
  try {
    if (process.platform === 'win32') {
      const out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
      const pids = new Set();
      for (const line of out.split(/\r?\n/)) {
        if (!/LISTENING/i.test(line)) continue;
        const pid = line.trim().split(/\s+/).pop();
        if (pid && /^\d+$/.test(pid)) pids.add(pid);
      }
      for (const pid of pids) {
        try {
          execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
        } catch {
          /* ignore */
        }
      }
      return;
    }
    execSync(`lsof -ti tcp:${port} | xargs kill -9`, { stdio: 'ignore', shell: true });
  } catch {
    /* port already free */
  }
}

const PROXY_MIN_VERSION = '2026-08-17-parsed';

/** Old dev-proxy only had POST /fetch — library search needs POST /search. */
async function proxySupportsSearch() {
  try {
    const health = await fetch(`http://127.0.0.1:${PROXY_PORT}/health`, {
      signal: AbortSignal.timeout(2500),
    });
    if (health.ok) {
      const body = await health.json();
      const version = String(body?.version ?? '');
      const hint = String(body?.hint ?? '');
      if (hint.includes('/search') && version >= PROXY_MIN_VERSION) return true;
    }
    const search = await fetch(`http://127.0.0.1:${PROXY_PORT}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: 'ab', limit: 1 }),
      signal: AbortSignal.timeout(4000),
    });
    return search.status !== 404;
  } catch {
    return false;
  }
}

async function waitUntilPortFree(port, waitMs = 4000) {
  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    if (!(await isPortOpen(port))) return true;
    await sleep(200);
  }
  return !(await isPortOpen(port));
}

function lanIPv4List() {
  const nets = os.networkInterfaces();
  const out = [];
  for (const rows of Object.values(nets)) {
    for (const row of rows ?? []) {
      if ((row.family === 'IPv4' || row.family === 4) && !row.internal) out.push(row.address);
    }
  }
  return out;
}

async function startProxyOnly() {
  const proxy = path.join(here, 'dev-proxy-server.mjs');
  const logPath = path.join(os.tmpdir(), 'recotune-chord-proxy.log');
  const logFd = fs.openSync(logPath, 'a');
  const child = spawn(process.execPath, [proxy], {
    cwd: here,
    detached: true,
    stdio: ['ignore', logFd, logFd],
    windowsHide: true,
    env: process.env,
  });
  child.on('error', err => console.warn('[chords:dev] spawn error:', err.message));
  child.on('exit', (code, signal) => {
    if (code) {
      console.warn(`[chords:dev] proxy exited ${code}${signal ? ` ${signal}` : ''} — ${logPath}`);
    }
  });
  child.unref();
  const ok = await waitForPort(PROXY_PORT, 'dev-proxy', WAIT_MS);
  if (!ok) {
    console.warn(`[chords:dev] log: ${logPath}`);
    try {
      const tail = fs.readFileSync(logPath, 'utf8').slice(-1200);
      if (tail.trim()) console.warn(tail.trim());
    } catch {
      /* ignore */
    }
  }
  return ok;
}

async function startDevStack(reason) {
  if (reason) console.warn(`[chords:dev] ${reason}`);
  killListeningPort(PROXY_PORT);
  await waitUntilPortFree(PROXY_PORT);

  const proxyReady = await startProxyOnly();
  if (!proxyReady) {
    console.warn(
      `[chords:dev] :${PROXY_PORT} not ready — run: node tools/chord-fetch/dev-proxy-server.mjs`,
    );
    process.exitCode = 1;
    return;
  }
  const ips = lanIPv4List();
  if (ips.length) {
    console.log(`[chords:dev] phone URL: http://${ips[0]}:${PROXY_PORT}/fetch`);
  }

  if (await isPortOpen(ULTIMATE_PORT)) {
    console.log(`[chords:dev] ultimate-api already on :${ULTIMATE_PORT}`);
    return;
  }

  const runUltimate = path.join(here, 'scripts', 'run-ultimate-api.mjs');
  const ug = spawn(process.execPath, [runUltimate], {
    cwd: here,
    detached: true,
    stdio: 'ignore',
    env: process.env,
  });
  ug.unref();
  const ugOk = await waitForPort(ULTIMATE_PORT, 'ultimate-api', 4000);
  if (!ugOk) {
    console.warn('[chords:dev] UG API :5000 not up (Python optional) — AmDm/GitHub still work');
  }
}

async function main() {
  const proxyUp = await isPortOpen(PROXY_PORT);
  const ultimateUp = await isPortOpen(ULTIMATE_PORT);

  if (proxyUp) {
    if (await proxySupportsSearch()) {
      if (ultimateUp) {
        console.log(`[chords:dev] already running (:${ULTIMATE_PORT}, :${PROXY_PORT})`);
      } else {
        console.log(`[chords:dev] proxy ready on :${PROXY_PORT} (UG API :${ULTIMATE_PORT} off — AmDm/GitHub ok)`);
      }
      const ips = lanIPv4List();
      if (ips.length) console.log(`[chords:dev] phone URL: http://${ips[0]}:${PROXY_PORT}/fetch`);
      return;
    }
    await startDevStack(`stale dev-proxy on :${PROXY_PORT} — restarting`);
    return;
  }

  if (ultimateUp) {
    await startDevStack(`:${ULTIMATE_PORT} up but :${PROXY_PORT} down — restarting stack`);
    return;
  }
  await startDevStack('starting dev-stack (ultimate-api + dev-proxy)…');
}

main().catch(err => {
  console.error('[chords:dev]', err);
  process.exit(1);
});
