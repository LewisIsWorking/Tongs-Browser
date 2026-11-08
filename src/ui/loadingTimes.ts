/**
 * ⏱️ How long the world took to open last time in this browser (2026-11-08).
 *
 * Lewis: "Reloads don't have a loading bar". The screen had a sliding bar but no idea how far along it was, and
 * nothing written in JavaScript can measure progress while Foundry holds the page. What CAN be known before the
 * page freezes is how long the same world took last time, so the bar fills over that long (LoadingOverlay) and
 * this file remembers the answer for next time. Kept in localStorage per world, plus the most recent load, which
 * stands in before Foundry has said which world it is opening. Every read and write survives a browser that
 * refuses storage (private windows, blocked site data): no history simply means the old sliding bar.
 */

const KEY = 'tongs-loading-times';

/** Shortest and longest times worth trusting: a cached instant reload or a stalled tab would mislead. */
const LOADING_TIME_MIN_MS = 2_000;
export const LOADING_TIME_MAX_MS = 5 * 60_000;

interface Saved {
  last?: number;
  worlds?: Record<string, number>;
}

function load(storage: Storage | undefined): Saved {
  try {
    const raw = storage?.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function usable(ms: unknown): number | undefined {
  return typeof ms === 'number' && ms >= LOADING_TIME_MIN_MS && ms <= LOADING_TIME_MAX_MS
    ? ms
    : undefined;
}

/** The time to expect: this world's last load if known, else the most recent load of any world, else none. */
export function expectedLoadMs(storage: Storage | undefined, worldId?: string): number | undefined {
  const saved = load(storage);
  return (worldId ? usable(saved.worlds?.[worldId]) : undefined) ?? usable(saved.last);
}

/** Remembers how long this load took, ignoring times too short or too long to be a real world load. */
export function rememberLoadMs(storage: Storage | undefined, ms: number, worldId?: string): void {
  if (usable(ms) === undefined) return;
  const saved = load(storage);
  const worlds = { ...(saved.worlds ?? {}) };
  if (worldId) worlds[worldId] = Math.round(ms);
  try {
    storage?.setItem(KEY, JSON.stringify({ last: Math.round(ms), worlds }));
  } catch {
    // Storage refused: next time is simply the sliding bar again.
  }
}

/** localStorage, or none where the browser refuses it: in a private window reading the property itself throws. */
export function browserStorage(scope: { readonly localStorage: Storage }): Storage | undefined {
  try {
    return scope.localStorage;
  } catch {
    return undefined;
  }
}
