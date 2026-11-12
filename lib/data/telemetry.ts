const counters = {
  success: 0,
  failures: 0,
  cacheHits: 0,
  sharedHits: 0,
  storageFailures: 0,
};
export function metric(event: keyof typeof counters) {
  counters[event]++;
}
export function metrics() {
  return { ...counters, scope: "current-process" };
}
export function logFailure(operation: string, code: string) {
  console.error(
    JSON.stringify({
      event: "ledger_failure",
      operation,
      code,
      time: new Date().toISOString(),
    }),
  );
}
