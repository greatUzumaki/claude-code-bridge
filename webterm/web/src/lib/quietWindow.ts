/**
 * Pure helper for quiet-window computation. Lives in lib/ so tests can import
 * it without triggering the service-worker bootstrap side effects in sw.ts.
 */

function parseHHMM(s: string): number {
  const [h, m] = s.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/**
 * Returns true when `nowMinutes` (local hours*60 + minutes) falls inside the
 * quiet window defined by `quietFrom`/`quietTo` ("HH:MM" strings).
 *
 * Handles midnight wrap-around: e.g. from=22:00, to=08:00 is active at 23:00
 * AND at 01:00.
 */
export function isInQuietWindow(quietFrom: string, quietTo: string, nowMinutes: number): boolean {
  const from = parseHHMM(quietFrom);
  const to = parseHHMM(quietTo);
  if (from <= to) {
    // Simple range, e.g. 08:00–20:00.
    return nowMinutes >= from && nowMinutes < to;
  }
  // Wraps midnight, e.g. 22:00–08:00.
  return nowMinutes >= from || nowMinutes < to;
}
