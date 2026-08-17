/**
 * Is there a world to test against, and is it ready? Extracted from foundry-session.ts 2026-08-17.
 *
 * Extracted because adding the stale-lock and neighbour-port diagnosis to requireActiveWorld pushed
 * that file to 197 lines, three short of the limit. A file sitting at its ceiling gets *trimmed* next
 * time it needs to grow, and trimming a diagnostic is how a message ends up saying "nothing is
 * answering" and nothing else. Splitting on the seam that was already there - "is the server usable"
 * versus "get this browser into the world" - leaves both halves with room.
 */
import { type Page } from 'playwright';

import { describeServerAbsence } from './serverAbsence.ts';
import { findNeighbourServers, findStaleLock } from './serverProbe.ts';

/**
 * A server answering is not a world being loaded, and only /api/status distinguishes them. Both
 * /join and /game return 200 either way, so probing those reports a healthy world when there is none.
 */
export async function requireActiveWorld(hostBase: string) {
  let status;
  try {
    const res = await fetch(`${hostBase}/api/status`, { signal: AbortSignal.timeout(5000) });
    status = await res.json();
  } catch {
    /*
     * ⚠️ The silence is the START of the diagnosis, not the end of it. See serverAbsence.ts: the old
     * one-line message sent the reader into a stale lock and past a healthy Foundry one port over,
     * both on 2026-08-15. Probing happens only on this path, so a healthy run pays nothing for it.
     */
    throw new Error(
      describeServerAbsence(hostBase, findStaleLock(), await findNeighbourServers(hostBase))
    );
  }
  if (status.active !== true) {
    throw new Error(`${hostBase} is up but no world is launched. Launch one, then run this again.`);
  }
  return status;
}

/**
 * Wait for the world to be usable, not merely painted.
 *
 * The UI renders well before game.ready, and asserting against a half initialised game reports races
 * as failures.
 */
export async function waitForReady(page: Page): Promise<void> {
  await page.waitForFunction(() => globalThis.game?.ready === true, undefined, {
    timeout: 120_000,
  });
}
