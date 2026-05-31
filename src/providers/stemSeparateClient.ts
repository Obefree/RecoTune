import * as FileSystem from 'expo-file-system/legacy';
import { stemHealthUrlFromSeparate } from './stemSeparateUrl';

export type StemServerStem = {
  id: string;
  label: string;
  color: string;
  b64: string;
  sizeKb: number;
};

export type StemServerHealth = {
  ok: boolean;
  demucs: boolean;
  version?: string;
  demucsError?: string;
  error?: string;
};

export class StemSeparateError extends Error {
  code?: string;
  status?: number;

  constructor(message: string, opts?: { code?: string; status?: number }) {
    super(message);
    this.name = 'StemSeparateError';
    this.code = opts?.code;
    this.status = opts?.status;
  }
}

export async function probeStemServer(separateUrl: string, timeoutMs = 5000): Promise<StemServerHealth> {
  const healthUrl = stemHealthUrlFromSeparate(separateUrl);
  if (!healthUrl) {
    return { ok: false, demucs: false, error: 'URL не задан' };
  }
  try {
    const res = await fetch(healthUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(timeoutMs),
    });
    const body = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      return {
        ok: false,
        demucs: false,
        error: typeof body.error === 'string' ? body.error : `HTTP ${res.status}`,
      };
    }
    return {
      ok: true,
      demucs: body.demucs === true,
      version: typeof body.version === 'string' ? body.version : undefined,
      demucsError: typeof body.demucsError === 'string' ? body.demucsError : undefined,
    };
  } catch (e) {
    return { ok: false, demucs: false, error: String(e) };
  }
}

function stemErrorMessage(payload: Record<string, unknown>, status: number): string {
  const code = typeof payload.code === 'string' ? payload.code : '';
  const err = typeof payload.error === 'string' ? payload.error : `HTTP ${status}`;
  if (code === 'DEMUCS_NOT_INSTALLED') {
    return `${err}\n\nУстановите Demucs на ПК (tools/stem-separate/README.md) и перезапустите npm run stems:dev`;
  }
  return err;
}

export async function separateStemsOnServer(
  separateUrl: string,
  audioUri: string,
  mode: 'vocals' | 'minus' | 'all',
  onProgress?: (msg: string) => void,
): Promise<StemServerStem[]> {
  if (!separateUrl.trim()) {
    throw new StemSeparateError('Сервер разделения не настроен', { code: 'NO_URL' });
  }

  onProgress?.('Чтение файла...');
  const audioBase64 = await FileSystem.readAsStringAsync(audioUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const name = audioUri.split('/').pop() ?? 'audio.wav';

  onProgress?.('Отправка на ПК (Demucs)...');
  const res = await fetch(separateUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ audioBase64, mode, filename: name }),
    signal: AbortSignal.timeout(900_000),
  });

  let payload: Record<string, unknown> = {};
  try {
    payload = (await res.json()) as Record<string, unknown>;
  } catch {
    payload = {};
  }

  if (!res.ok) {
    throw new StemSeparateError(stemErrorMessage(payload, res.status), {
      code: typeof payload.code === 'string' ? payload.code : undefined,
      status: res.status,
    });
  }

  const stems = payload.stems;
  if (!Array.isArray(stems) || stems.length === 0) {
    throw new StemSeparateError('Сервер не вернул дорожки', { code: 'EMPTY_STEMS' });
  }

  return stems as StemServerStem[];
}
