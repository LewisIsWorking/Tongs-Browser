/**
 * Gathering the facts describeServerAbsence explains. Written 2026-08-17.
 *
 * Split from the describing on purpose, and for the reason the join reply is split from its
 * interpretation: reading the world and deciding what it means are separately wrong-able. Everything
 * that touches the filesystem or the network lives here, so serverAbsence.ts stays a pure function
 * that can be tested against every finding including the ones that are awkward to stage for real.
 *
 * ⚠️ Nothing here throws. This module only ever runs on a path where something has ALREADY failed,
 * and a diagnostic that fails while diagnosing replaces a bad message with no message.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { type LockFinding, type NeighbourServer } from './serverAbsence.ts';

/** Where Foundry's own docs put the data directory on this platform, if we can say. */
function defaultDataPath(): string | null {
  const explicit = process.env['FOUNDRY_DATA_PATH'];
  if (explicit !== undefined && explicit !== '') return explicit;
  if (process.platform === 'win32') {
    const local = process.env['LOCALAPPDATA'];
    return local === undefined || local === '' ? null : join(local, 'FoundryVTT');
  }
  return null;
}

/**
 * Whether a stale lock is sitting in the data directory.
 *
 * ⚠️ Only ever called once the port has been found silent, which is what makes a present lock
 * necessarily stale. The same directory during a healthy run is correct and means nothing.
 */
export function findStaleLock(dataPath: string | null = defaultDataPath()): LockFinding {
  if (dataPath === null) {
    return {
      kind: 'unchecked',
      why: 'no FOUNDRY_DATA_PATH set and this platform has no default worth guessing',
    };
  }
  const path = join(dataPath, 'Config', 'options.json.lock');
  try {
    return existsSync(path) ? { kind: 'held', path } : { kind: 'absent', path };
  } catch (error) {
    return { kind: 'unchecked', why: `${path} could not be read (${String(error)})` };
  }
}

/**
 * Ports worth trying when the configured one is silent.
 *
 * Deliberately a short, derived, explainable list rather than a scan: the port next door (a second
 * server on the same machine is how this bit) and Foundry's own default, which is what a reader who
 * overrode FOUNDRY_HOST_URL by mistake actually wanted.
 */
export function neighbourPorts(base: string): number[] {
  let port: number;
  try {
    port = Number(new URL(base).port || '30000');
  } catch {
    return [];
  }
  const candidates = [port + 1, port + 2, 30000];
  return [...new Set(candidates)].filter((one) => one !== port && one > 0 && one < 65536);
}

/**
 * Any Foundry answering on a neighbouring port, with the world it has open.
 *
 * ⚠️ `ports` is a parameter, and that is not gratuitous. It defaults to `neighbourPorts(base)`, which
 * ALWAYS includes Foundry's default 30000, so with the list implicit there was no argument that could
 * make this function probe a set of closed ports. The test asserting "reports nothing when nothing is
 * listening" therefore passed only while Foundry happened to be down, and failed the moment a real
 * server came up on 2026-08-18 - a test that was measuring the machine rather than the code.
 */
export async function findNeighbourServers(
  base: string,
  ports: readonly number[] = neighbourPorts(base)
): Promise<NeighbourServer[]> {
  const found: NeighbourServer[] = [];
  for (const port of ports) {
    let candidate: URL;
    try {
      candidate = new URL(base);
    } catch {
      return found;
    }
    candidate.port = String(port);
    const origin = candidate.origin;
    try {
      const res = await fetch(`${origin}/api/status`, { signal: AbortSignal.timeout(1500) });
      const status = (await res.json()) as { active?: boolean; world?: string };
      found.push({ base: origin, world: status.active === true ? (status.world ?? null) : null });
    } catch {
      // Silence on a neighbour is the expected case and is not a finding.
    }
  }
  return found;
}
