/** Serializes SQLite writes — expo-sqlite rejects nested withTransactionAsync on one connection. */
let writeChain: Promise<void> = Promise.resolve();

export function enqueueSqliteWrite<T>(fn: () => Promise<T>): Promise<T> {
  const run = writeChain.then(() => fn());
  writeChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}
