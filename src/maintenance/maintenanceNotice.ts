/**
 * ComeOnOverUno's nightly Foundry update, as the people in a world see it. Added 2026-10-11.
 *
 * ⛔ ASKED FOR BY LEWIS: "I'd rather we just force people off the world and give them a detailed progress
 * UI". Every night at 06:00 UK time COO closes the open world, updates Foundry, the system and the modules,
 * and opens the same world again. At 05:55 it starts saying so; this is what Tongs makes of it:
 *   - `warning`: a countdown banner for everyone in the world;
 *   - `running`: the world is closing or closed, so the browser goes to COO's progress page, which lists
 *     every step as it happens and sends people back when the world is open again.
 *
 * ⚠️ The countdown uses the SERVER's clock. A phone whose clock is two minutes out would otherwise say "1:00
 * left" as the world closes, so the answer carries the server's `now` and the gap is kept as `skewMs`.
 *
 * Pure: the server's answer and the times are handed in, so nothing here needs Foundry or a network.
 */
export const MAINTENANCE_PATH = '/coo-api/foundry/maintenance';
export const PROGRESS_PAGE = '/coo-updating';

type Phase = 'idle' | 'warning' | 'running' | 'done' | 'failed';
const PHASES: readonly Phase[] = ['idle', 'warning', 'running', 'done', 'failed'];

export interface Maintenance {
  readonly phase: Phase;
  /** The world being updated, or null when none was open. */
  readonly world: string | null;
  /** When the warned world closes, on the server's clock (ms since the epoch). */
  readonly closesAt: number | null;
  /** The server's clock minus this browser's, when the answer was read. */
  readonly skewMs: number;
}

export type Verdict =
  | { readonly kind: 'none' }
  | { readonly kind: 'banner'; readonly secondsLeft: number }
  | { readonly kind: 'leave' };

const time = (value: unknown): number | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
};

/** COO's answer, or null for anything else (a world not hosted by COO answers with Foundry's own 404 page). */
export function readMaintenance(body: unknown, localNow: number): Maintenance | null {
  const raw = body as Record<string, unknown> | null | undefined;
  const phase = raw?.['phase'];
  if (typeof phase !== 'string' || !PHASES.includes(phase as Phase)) {
    return null;
  }
  const serverNow = time(raw?.['now']);
  return {
    phase: phase as Phase,
    world: typeof raw?.['world'] === 'string' ? raw['world'] : null,
    closesAt: time(raw?.['closesAt']),
    skewMs: serverNow === null ? 0 : serverNow - localNow,
  };
}

/**
 * What this browser should do. Only the world being updated is affected: COO runs one world at a time, but
 * a stale tab on another world must not be sent away from it.
 */
export function verdict(
  state: Maintenance | null,
  worldId: string | undefined,
  localNow: number
): Verdict {
  if (state === null || (state.world !== null && state.world !== worldId)) {
    return { kind: 'none' };
  }
  if (state.phase === 'running') {
    return { kind: 'leave' };
  }
  if (state.phase === 'warning' && state.closesAt !== null) {
    const left = (state.closesAt - (localNow + state.skewMs)) / 1000;
    return { kind: 'banner', secondsLeft: Math.max(0, Math.ceil(left)) };
  }
  return { kind: 'none' };
}

/** "4:32" */
function clock(seconds: number): string {
  return `${String(Math.floor(seconds / 60))}:${String(seconds % 60).padStart(2, '0')}`;
}

/** The banner's words: when, why, and that nothing is lost. */
export function bannerText(secondsLeft: number): string {
  const when = secondsLeft > 0 ? `closes in ${clock(secondsLeft)}` : 'is closing now';
  return `🛠️ Nightly Foundry update: this world ${when}. Everything is saved, and you will be taken to a page showing the update's progress until it reopens.`;
}
