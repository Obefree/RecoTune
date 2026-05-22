import { enqueueSqliteWrite } from '../db/sqliteWriteLock';

let importRunning = false;

export function isMetadataSyncRunning(): boolean {
  return importRunning;
}

/** Same queue as metadata batch writes and catalog search — no nested transactions. */
export function runMetadataImportExclusive<T>(fn: () => Promise<T>): Promise<T> {
  importRunning = true;
  return enqueueSqliteWrite(fn).finally(() => {
    importRunning = false;
  });
}

/** Russian UI text — never show expo-sqlite stack traces. */
export function formatMetadataSyncError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (
    /transaction within a transaction|nested transaction|cannot start a transaction/i.test(raw)
  ) {
    return 'Каталог ещё загружается. Подождите и нажмите «Повторить».';
  }
  if (/NativeDatabase|expo-sqlite|SQLITE|execAsync/i.test(raw)) {
    return 'Ошибка локальной базы. Повторите загрузку каталога.';
  }
  if (raw.length > 100 || /\bat\s+\w+\./i.test(raw)) {
    return 'Не удалось загрузить каталог. Повторите попытку.';
  }
  return raw.trim() || 'Не удалось загрузить каталог метаданных';
}
