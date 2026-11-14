import { LOADING_ORDER, type StageSeconds } from './loadingEstimate.js';

/**
 * 🗂️ How long each loading stage took on this browser's recent loads of each world, so the loading screen's
 * percentage and time left come from this world rather than a guess. Added 2026-11-14.
 *
 * Kept in localStorage, the only storage there is before Foundry has started: world settings and flags do not
 * exist until `ready`, which is when the screen goes. ⚠️ EVERY read and write is wrapped: storage can be missing,
 * full, blocked by the browser or hold another version's shape, and none of that may stop Foundry opening. A
 * failure only costs the time left, never the screen.
 *
 * The typical stage is the median of the newest few loads, so one slow load (a cold cache, a busy server) moves
 * it less than an average would. The world id is unknown until Foundry has fetched the world, so the first
 * stage is measured against the world this browser opened last, which is nearly always the same one.
 */

export const LOADING_HISTORY_KEY = 'tongs-browser.loading-times';
/** Loads kept per stage. */
export const LOADING_SAMPLES = 5;
/** Worlds remembered; the one opened longest ago is forgotten first. */
const MAX_WORLDS = 8;

/** The bit of Web Storage this uses. */
export interface LoadingStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface WorldTimes {
  at: number;
  stages: Partial<Record<string, number[]>>;
}

interface Stored {
  last?: string;
  worlds: Record<string, WorldTimes>;
}

export class LoadingHistory {
  public constructor(
    private readonly store: () => LoadingStore | null | undefined,
    private readonly now: () => number = Date.now
  ) {}

  /** The typical seconds of each stage for `worldId`, or for the world opened last when it is not known yet. */
  public typical(worldId?: string | null): StageSeconds {
    const stored = this.read();
    const id = worldId ?? stored.last;
    const world = id === undefined ? undefined : stored.worlds[id];
    const typical: StageSeconds = {};
    for (const stage of LOADING_ORDER) {
      const middle = median(world?.stages[stage] ?? []);
      if (middle !== null) typical[stage] = middle;
    }
    return typical;
  }

  /** Adds one finished load of `worldId`, keeping the newest few per stage and forgetting the oldest worlds. */
  public record(worldId: string, seconds: StageSeconds): void {
    const stored = this.read();
    const world = stored.worlds[worldId] ?? { at: 0, stages: {} };
    for (const stage of LOADING_ORDER) {
      const value = seconds[stage];
      if (!isDuration(value)) continue;
      world.stages[stage] = [...(world.stages[stage] ?? []), value].slice(-LOADING_SAMPLES);
    }
    world.at = this.now();
    stored.worlds[worldId] = world;
    const keep = Object.entries(stored.worlds)
      .sort(([, a], [, b]) => b.at - a.at)
      .slice(0, MAX_WORLDS);
    this.write({ last: worldId, worlds: Object.fromEntries(keep) });
  }

  private read(): Stored {
    try {
      const raw = this.store()?.getItem(LOADING_HISTORY_KEY);
      return raw ? parse(JSON.parse(raw)) : { worlds: {} };
    } catch {
      return { worlds: {} };
    }
  }

  private write(stored: Stored): void {
    try {
      this.store()?.setItem(LOADING_HISTORY_KEY, JSON.stringify(stored));
    } catch {
      // Full, blocked or missing: this load simply is not remembered.
    }
  }
}

/** Keeps only what has the right shape, so a damaged or older entry is ignored rather than trusted. */
function parse(value: unknown): Stored {
  const stored: Stored = { worlds: {} };
  if (typeof value !== 'object' || value === null) return stored;
  const { last, worlds } = value as { last?: unknown; worlds?: unknown };
  if (typeof last === 'string') stored.last = last;
  if (typeof worlds !== 'object' || worlds === null) return stored;
  for (const [id, world] of Object.entries(worlds as Record<string, unknown>)) {
    if (typeof world !== 'object' || world === null) continue;
    const { at, stages } = world as { at?: unknown; stages?: unknown };
    const kept: WorldTimes = { at: typeof at === 'number' ? at : 0, stages: {} };
    if (typeof stages === 'object' && stages !== null) {
      for (const [stage, samples] of Object.entries(stages as Record<string, unknown>)) {
        if (Array.isArray(samples)) kept.stages[stage] = samples.filter(isDuration);
      }
    }
    stored.worlds[id] = kept;
  }
  return stored;
}

function isDuration(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

/** The middle value, or the mean of the middle two; null for none. */
export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[mid] ?? null)
    : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}
