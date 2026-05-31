#!/usr/bin/env node
/**
 * Local stem separation + melody transcription proxy for RecoTune (PC).
 * POST http://<PC-IP>:8788/separate   { audioBase64, mode }
 * POST http://<PC-IP>:8788/transcribe { audioBase64 }
 * GET  /health
 */

import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

export const STEM_SEPARATE_PROXY_VERSION = '2026-05-31-demucs-basicpitch-v1';

const PORT = Number(process.env.STEM_SEPARATE_PORT || 8788);
const MAX_BYTES = Number(process.env.STEM_MAX_UPLOAD_BYTES || 80 * 1024 * 1024);
const here = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(here, '.stem-cache');
const UPLOAD_DIR = path.join(here, '.stem-uploads');

const PYTHON = process.env.STEM_PYTHON?.trim() || (process.platform === 'win32' ? 'python' : 'python3');
const DEMUCS_SCRIPT = path.join(here, 'demucs_run.py');
const BASIC_PITCH_SCRIPT = path.join(here, 'basic_pitch_run.py');

let demucsCheckCache = { at: 0, demucs: false, python: PYTHON, error: '' };
let basicPitchCheckCache = { at: 0, basic_pitch: false, python: PYTHON, error: '' };

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
  });
  res.end(payload);
}

function runPythonScript(scriptPath, args, timeoutMs = 900_000) {
  return new Promise((resolve, reject) => {
    const proc = spawn(PYTHON, [scriptPath, ...args], {
      cwd: here,
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error('Python timeout'));
    }, timeoutMs);
    proc.stdout.on('data', d => {
      stdout += d.toString();
    });
    proc.stderr.on('data', d => {
      stderr += d.toString();
    });
    proc.on('error', err => {
      clearTimeout(timer);
      reject(err);
    });
    proc.on('close', code => {
      clearTimeout(timer);
      const line = stdout.trim().split(/\r?\n/).filter(Boolean).pop() ?? '';
      let parsed = null;
      try {
        parsed = JSON.parse(line);
      } catch {
        /* ignore */
      }
      resolve({ code, stdout, stderr, parsed });
    });
  });
}

async function checkDemucs(force = false) {
  const now = Date.now();
  if (!force && now - demucsCheckCache.at < 30_000) return demucsCheckCache;
  try {
    const { parsed, stderr, code } = await runPythonScript(
      DEMUCS_SCRIPT,
      ['--check-only', '--input', '.', '--work-dir', CACHE_DIR],
      60_000,
    );
    if (parsed?.ok) {
      demucsCheckCache = {
        at: now,
        demucs: !!parsed.demucs,
        python: parsed.python ?? PYTHON,
        error: parsed.demucs ? '' : 'demucs не установлен в этом Python',
      };
    } else {
      demucsCheckCache = {
        at: now,
        demucs: false,
        python: PYTHON,
        error: stderr?.slice(0, 400) || `check exit ${code}`,
      };
    }
  } catch (e) {
    demucsCheckCache = {
      at: now,
      demucs: false,
      python: PYTHON,
      error: e?.code === 'ENOENT'
        ? `Python не найден (${PYTHON}). Задайте STEM_PYTHON=путь\\к\\python.exe`
        : String(e?.message ?? e),
    };
  }
  return demucsCheckCache;
}

async function checkBasicPitch(force = false) {
  const now = Date.now();
  if (!force && now - basicPitchCheckCache.at < 30_000) return basicPitchCheckCache;
  try {
    const { parsed, stderr, code } = await runPythonScript(BASIC_PITCH_SCRIPT, ['--check-only'], 60_000);
    if (parsed?.ok) {
      basicPitchCheckCache = {
        at: now,
        basic_pitch: !!parsed.basic_pitch,
        python: parsed.python ?? PYTHON,
        error: parsed.basic_pitch ? '' : 'basic-pitch не установлен в этом Python',
      };
    } else {
      basicPitchCheckCache = {
        at: now,
        basic_pitch: false,
        python: PYTHON,
        error: stderr?.slice(0, 400) || `check exit ${code}`,
      };
    }
  } catch (e) {
    basicPitchCheckCache = {
      at: now,
      basic_pitch: false,
      python: PYTHON,
      error: e?.code === 'ENOENT'
        ? `Python не найден (${PYTHON}). Задайте STEM_PYTHON=путь\\к\\python.exe`
        : String(e?.message ?? e),
    };
  }
  return basicPitchCheckCache;
}

async function readBody(req, limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error('PAYLOAD_TOO_LARGE');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function fileToB64(filePath) {
  const buf = await fs.readFile(filePath);
  return buf.toString('base64');
}

async function decodeUploadAudio(body) {
  const b64 = typeof body.audioBase64 === 'string' ? body.audioBase64.trim() : '';
  if (!b64) {
    return { error: { status: 400, payload: { error: 'Нужно поле audioBase64', code: 'MISSING_AUDIO' } } };
  }
  let audioBuf;
  try {
    audioBuf = Buffer.from(b64, 'base64');
  } catch {
    return { error: { status: 400, payload: { error: 'Некорректный base64', code: 'BAD_AUDIO' } } };
  }
  if (!audioBuf.length) {
    return { error: { status: 400, payload: { error: 'Пустой аудиофайл', code: 'BAD_AUDIO' } } };
  }
  if (audioBuf.length > MAX_BYTES) {
    return {
      error: {
        status: 413,
        payload: { error: `Файл больше ${Math.round(MAX_BYTES / 1024 / 1024)} МБ`, code: 'TOO_LARGE' },
      },
    };
  }

  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const jobId = randomUUID();
  const ext = typeof body.filename === 'string' && /\.(wav|mp3|m4a|flac|ogg|aac)$/i.test(body.filename)
    ? body.filename.replace(/^.*\./, '.')
    : '.wav';
  const audioPath = path.join(UPLOAD_DIR, `${jobId}${ext}`);
  await fs.writeFile(audioPath, audioBuf);
  return { audioPath, jobId };
}

async function handleSeparate(body) {
  const mode = ['vocals', 'minus', 'all'].includes(body.mode) ? body.mode : 'minus';

  const check = await checkDemucs(true);
  if (!check.demucs) {
    return {
      status: 503,
      payload: {
        error: check.error || 'Demucs недоступен. Установите зависимости Python (см. tools/stem-separate/README.md).',
        code: 'DEMUCS_NOT_INSTALLED',
        python: check.python,
      },
    };
  }

  const upload = await decodeUploadAudio(body);
  if (upload.error) return upload.error;

  const { audioPath, jobId } = upload;
  const workDir = path.join(CACHE_DIR, jobId);
  await fs.mkdir(workDir, { recursive: true });

  const { parsed, stderr, code } = await runPythonScript(DEMUCS_SCRIPT, [
    '--input', audioPath,
    '--work-dir', workDir,
    '--mode', mode,
  ]);

  try {
    await fs.unlink(audioPath).catch(() => {});
  } catch {
    /* ignore */
  }

  if (!parsed?.ok) {
    const errMsg = parsed?.error || stderr?.slice(0, 500) || `Demucs exit ${code}`;
    return {
      status: parsed?.code === 'DEMUCS_NOT_INSTALLED' ? 503 : 500,
      payload: {
        error: errMsg,
        code: parsed?.code ?? 'DEMUCS_FAILED',
      },
    };
  }

  const stems = [];
  for (const s of parsed.stems ?? []) {
    const b64out = await fileToB64(s.path);
    stems.push({
      id: s.id,
      label: s.label,
      color: s.color,
      b64: b64out,
      sizeKb: s.sizeKb ?? Math.max(1, Math.round(Buffer.byteLength(b64out, 'utf8') * 0.75 / 1024)),
    });
  }

  try {
    await fs.rm(workDir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }

  return { status: 200, payload: { ok: true, stems, mode, engine: 'demucs' } };
}

async function handleTranscribe(body) {
  const check = await checkBasicPitch(true);
  if (!check.basic_pitch) {
    return {
      status: 503,
      payload: {
        error: check.error || 'basic-pitch недоступен. Установите pip install basic-pitch (см. README).',
        code: 'BASIC_PITCH_NOT_INSTALLED',
        python: check.python,
      },
    };
  }

  const upload = await decodeUploadAudio(body);
  if (upload.error) return upload.error;

  const { audioPath } = upload;
  const timeoutMs = Number(process.env.STEM_TRANSCRIBE_TIMEOUT_MS || 600_000);

  const { parsed, stderr, code } = await runPythonScript(
    BASIC_PITCH_SCRIPT,
    ['--input', audioPath],
    timeoutMs,
  );

  try {
    await fs.unlink(audioPath).catch(() => {});
  } catch {
    /* ignore */
  }

  if (!parsed?.ok) {
    const errMsg = parsed?.error || stderr?.slice(0, 500) || `basic-pitch exit ${code}`;
    const status =
      parsed?.code === 'BASIC_PITCH_NOT_INSTALLED' ? 503
      : parsed?.code === 'NO_NOTES' ? 422
      : 500;
    return {
      status,
      payload: {
        error: errMsg,
        code: parsed?.code ?? 'BASIC_PITCH_FAILED',
      },
    };
  }

  return {
    status: 200,
    payload: {
      ok: true,
      engine: 'basic-pitch',
      notes: parsed.notes ?? [],
      noteCount: parsed.noteCount ?? (parsed.notes?.length ?? 0),
    },
  };
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Accept',
    });
    res.end();
    return;
  }

  if (req.method === 'GET' && (req.url === '/' || req.url === '/health')) {
    const [demucsCheck, bpCheck] = await Promise.all([checkDemucs(), checkBasicPitch()]);
    json(res, 200, {
      ok: true,
      version: STEM_SEPARATE_PROXY_VERSION,
      port: PORT,
      demucs: demucsCheck.demucs,
      basic_pitch: bpCheck.basic_pitch,
      python: demucsCheck.python,
      demucsError: demucsCheck.demucs ? undefined : demucsCheck.error,
      basicPitchError: bpCheck.basic_pitch ? undefined : bpCheck.error,
      hint: 'POST /separate { audioBase64, mode } · POST /transcribe { audioBase64 }',
    });
    return;
  }

  if (req.method !== 'POST' || (req.url !== '/separate' && req.url !== '/transcribe')) {
    json(res, 404, { error: 'Используйте GET /health, POST /separate или POST /transcribe' });
    return;
  }

  let body = {};
  try {
    const raw = await readBody(req, MAX_BYTES * 1.4);
    body = JSON.parse(raw || '{}');
  } catch (e) {
    if (e?.message === 'PAYLOAD_TOO_LARGE') {
      json(res, 413, { error: 'Слишком большой запрос', code: 'TOO_LARGE' });
      return;
    }
    json(res, 400, { error: 'Тело запроса должно быть JSON' });
    return;
  }

  try {
    const { status, payload } =
      req.url === '/transcribe' ? await handleTranscribe(body) : await handleSeparate(body);
    json(res, status, payload);
  } catch (e) {
    json(res, 500, { error: e?.message ?? 'Internal error', code: 'SERVER_ERROR' });
  }
});

await fs.mkdir(CACHE_DIR, { recursive: true });
await fs.mkdir(UPLOAD_DIR, { recursive: true });

server.listen(PORT, '0.0.0.0', () => {
  console.log(`RecoTune stem-separate proxy: http://0.0.0.0:${PORT}/health (${STEM_SEPARATE_PROXY_VERSION})`);
  console.log(`Python: ${PYTHON} · Demucs + basic-pitch check on first request`);
  console.log('Установка: tools/stem-separate/README.md');
});
