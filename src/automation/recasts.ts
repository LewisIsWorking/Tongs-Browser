import type { SpellDamageFacts } from './spellDamageFacts.js';
import type { CastWithTargets } from './validateSpellDamage.js';

/**
 * Telling a re-click from a second cast. Added 2026-10-07.
 *
 * ⛔ MEASURED ON C04: Nadya's player posted Daze at Kreski three times in twenty seconds (06:27:44,
 * 06:27:56, 06:28:04 UTC) and rolled damage once. Daze is one save, but each cast card asks for its own,
 * so Kreski rolled three. A cast of the same spell, by the same caster, at the same targets, within
 * `RECAST_WINDOW_MS` and with no damage rolled for that spell in between, is the SAME cast posted again:
 * only the first of such a run is rolled, and damage after any of them uses that first save.
 *
 * In play-by-post a real second cast at the same creature comes a turn later, hours apart, so the
 * window only has to cover a player clicking again because nothing seemed to happen.
 */
export const RECAST_WINDOW_MS = 2 * 60 * 1000;

const sameTargets = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((token) => b.includes(token));

/** True when `later` is `earlier` posted again, as described above. */
export function isRecast(
  earlier: CastWithTargets,
  later: CastWithTargets,
  damages: readonly SpellDamageFacts[]
): boolean {
  return (
    earlier.id !== later.id &&
    earlier.actorId === later.actorId &&
    earlier.spellUuid === later.spellUuid &&
    earlier.castRank === later.castRank &&
    later.timestamp >= earlier.timestamp &&
    later.timestamp - earlier.timestamp <= RECAST_WINDOW_MS &&
    sameTargets(earlier.targets, later.targets) &&
    !damages.some(
      (each) =>
        each.actorId === earlier.actorId &&
        each.spellUuid === earlier.spellUuid &&
        each.timestamp >= earlier.timestamp &&
        each.timestamp <= later.timestamp
    )
  );
}

/** The run of re-clicks `cast` belongs to, first cast first; just `[cast]` when it is a cast of its own. */
export function recastRun(
  cast: CastWithTargets,
  casts: readonly CastWithTargets[],
  damages: readonly SpellDamageFacts[]
): CastWithTargets[] {
  const run = [cast];
  let first = cast;
  for (;;) {
    const earliest = first;
    const before = casts
      .filter((each) => isRecast(each, earliest, damages))
      .sort((a, b) => b.timestamp - a.timestamp)[0];
    if (before === undefined || run.includes(before)) {
      return run;
    }
    run.unshift(before);
    first = before;
  }
}
