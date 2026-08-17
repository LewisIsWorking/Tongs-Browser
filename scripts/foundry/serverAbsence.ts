/**
 * Saying WHY nothing is answering, when nothing is answering.
 * Written 2026-08-17, from a round-trip this message caused.
 *
 * The old sentence was `nothing is answering on http://localhost:30000. Start Foundry and launch a
 * world.` Every word of that is true and it still sent the reader somewhere useless twice in one
 * evening:
 *
 *   1. A stale lock. Foundry acquires its data directory with an atomic mkdir of
 *      `Config/options.json.lock`. A server that dies without unwinding leaves the directory behind,
 *      and `acquireLockFile` cannot tell that from a live holder - so the NEXT launch dies with
 *      `cannot start in this directory which is already locked by another process` about a process
 *      that does not exist. Measured: an empty lock directory left at 20:32 by an exit-code-4
 *      shutdown, after which two launches failed instantly at 19:34 the following evening.
 *      Following "Start Foundry and launch a world" reproduces that failure, and the harness had
 *      never mentioned a lock.
 *
 *   2. The wrong port. This machine runs a second Foundry on :30001 against a separate dataPath
 *      (`FoundryVTT-harness`, world `cooharness`). Reading `nothing is answering` while a perfectly
 *      healthy Foundry sits one port over reads as "Foundry is down", which is the worst kind of
 *      wrong message - it accuses the thing under test. Naming the neighbour turns a hunt into a
 *      one-line correction.
 *
 * ⚠️ THREE answers about the lock, not two. `absent` means it was looked for and is not there;
 * `unchecked` means it could not be looked for at all. Collapsing those would let this claim "no
 * stale lock" about a directory it never read, which is the same class of lie as a probe that
 * searches the wrong name.
 */

/** What was learned about the data directory lock, including "nothing was learned". */
export type LockFinding =
  | { readonly kind: 'held'; readonly path: string }
  | { readonly kind: 'absent'; readonly path: string }
  | { readonly kind: 'unchecked'; readonly why: string };

/** A Foundry answering somewhere other than where we looked. */
export interface NeighbourServer {
  readonly base: string;
  readonly world: string | null;
}

const START_IT = 'Start Foundry and launch a world.';

function describeLock(lock: LockFinding): string {
  if (lock.kind === 'held') {
    return (
      ` A STALE LOCK is in the way: ${lock.path} exists while nothing is listening. Foundry will ` +
      `refuse to start with "already locked by another process" until it is removed, naming a ` +
      `process that no longer exists. Remove that directory first, then launch.`
    );
  }
  if (lock.kind === 'unchecked') {
    return ` The data directory lock was not checked (${lock.why}), so a stale one is not ruled out.`;
  }
  return '';
}

function describeNeighbours(neighbours: readonly NeighbourServer[]): string {
  if (neighbours.length === 0) return '';
  const listed = neighbours
    .map((one) =>
      one.world === null ? `${one.base} (no world launched)` : `${one.base} (world '${one.world}')`
    )
    .join(', ');
  return (
    ` A Foundry IS answering elsewhere: ${listed}. If that is the one you meant, set ` +
    `FOUNDRY_HOST_URL to it - note a different dataPath has its own modules, so tongs-browser may ` +
    `not be installed there.`
  );
}

/**
 * The whole explanation, as one sentence per finding.
 *
 * Ordered by what the reader should do first: the address that failed, then the thing that will
 * block the retry, then the thing that makes the retry unnecessary.
 */
export function describeServerAbsence(
  hostBase: string,
  lock: LockFinding,
  neighbours: readonly NeighbourServer[] = []
): string {
  return `nothing is answering on ${hostBase}. ${START_IT}${describeLock(lock)}${describeNeighbours(neighbours)}`;
}
