import type { FoundryBinding } from './snapshot.ts';

/**
 * Whether the snapshot still describes the Foundry that is actually installed. Added 2026-09-10.
 *
 * ⛔ WHY THIS HAD TO EXIST. `check-keybinding-coverage` compares the ROUTING TABLE against the
 * SNAPSHOT, and both of those are ours. It cannot notice that Foundry has moved underneath them, so
 * it printed "OK: all 37 core keybinding(s) from Foundry 14.366 are accounted for" on a machine
 * running 14.367, where four bindings were unaccounted for and one key had changed meaning. Green,
 * and wrong, with nothing in the output hinting at it.
 *
 * ⛔ THE SNAPSHOT'S FRESHNESS WAS ENFORCED BY A SENTENCE IN A DOCUMENT telling a human to re-take it
 * on a version bump. That is a habit, not a gate, and the gap it left was invisible precisely
 * because the guard beside it was green. A check whose inputs are all written by us can only ever
 * prove we are consistent with ourselves.
 *
 * ⚠️ This is the LIVE half, and it is deliberately separate from the CI guard rather than folded
 * into it. The guard must run where there is no Foundry, and a check that silently skips is not a
 * check; this one requires a Foundry and fails when it cannot find one.
 */
export interface FreshnessProblem {
  readonly binding: string;
  readonly reason: string;
}

const keysOf = (binding: FoundryBinding): string => binding.keys.join(', ') || '(unbound)';

/**
 * Families Foundry registers in a LOOP with a computed name, which the snapshot records ONCE.
 *
 * ⛔ NOT A CONVENIENCE. Foundry registers `executeMacro0`..`executeMacro9` and `swapMacroPage1`..`5`,
 * fifteen actions for two capabilities. The snapshot deliberately holds the base name only, and says
 * so, because what a coverage table needs to decide is whether the CAPABILITY is reachable, not how
 * many numbered copies of it exist.
 *
 * ⚠️ Without this, the freshness check reports fifteen bindings as new on every single run, for ever.
 * A check that always fails is a check nobody reads, and it would have buried the one real finding
 * underneath it. The families are named explicitly rather than matched by a "strip trailing digits"
 * rule, so a genuinely new `move2` could never be swallowed by it.
 */
const LOOPED_FAMILIES = ['executeMacro', 'swapMacroPage'];

function collapseFamilies(bindings: readonly FoundryBinding[]): FoundryBinding[] {
  const seen = new Set<string>();
  const collapsed: FoundryBinding[] = [];

  for (const binding of bindings) {
    const family = LOOPED_FAMILIES.find(
      (base) => /^\d+$/.test(binding.name.slice(base.length)) && binding.name.startsWith(base)
    );
    const name = family ?? binding.name;
    if (seen.has(name)) {
      continue;
    }
    seen.add(name);
    /*
     * ⚠️ A collapsed family reports NO keys, because the members do not share one: executeMacro1 is
     * Digit1 and executeMacro2 is Digit2. Claiming the first member's key for the family would make
     * the key comparison assert something untrue.
     */
    collapsed.push(family === undefined ? binding : { name, keys: [] });
  }

  return collapsed;
}

/**
 * ⚠️ Compares three separate things, and the third is the one that matters most.
 *
 *   1. bindings Foundry has that the snapshot does not  (a new capability, unrouted)
 *   2. bindings the snapshot has that Foundry does not  (a routing decision about nothing)
 *   3. bindings whose KEYS CHANGED                      (the silent one)
 *
 * ⛔ THE THIRD IS WHY THIS IS NOT JUST A NAME DIFF. Between 14.366 and 14.367 `moveDownRight` lost
 * `KeyE` and the new `ascend` gained it. Every name still present, every count still plausible, and
 * a routing table that kept reading sensibly while pointing at a different capability. A key that
 * changes hands is worse than one that disappears, because nothing about it looks wrong.
 */
export function compareToLive(
  snapshot: readonly FoundryBinding[],
  rawLive: readonly FoundryBinding[]
): FreshnessProblem[] {
  const problems: FreshnessProblem[] = [];
  const live = collapseFamilies(rawLive);
  const byName = new Map(snapshot.map((binding) => [binding.name, binding]));
  const liveByName = new Map(live.map((binding) => [binding.name, binding]));

  for (const binding of live) {
    const known = byName.get(binding.name);
    if (known === undefined) {
      problems.push({
        binding: binding.name,
        reason: `is registered by this Foundry and is NOT in the snapshot (keys: ${keysOf(binding)})`,
      });
      continue;
    }
    /*
     * ⚠️ A LOOPED FAMILY IS CHECKED FOR PRESENCE ONLY. Its members do not share a key, so it is
     * collapsed with none, and comparing that against whichever key the snapshot happened to record
     * for the family would report a move on every run. Presence is the whole question for these:
     * the capability is "run a macro from the hotbar", not "run macro number 4".
     */
    if (LOOPED_FAMILIES.includes(binding.name)) {
      continue;
    }
    if (keysOf(known) !== keysOf(binding)) {
      problems.push({
        binding: binding.name,
        reason: `has moved: the snapshot says ${keysOf(known)}, this Foundry says ${keysOf(binding)}`,
      });
    }
  }

  for (const binding of snapshot) {
    if (!liveByName.has(binding.name)) {
      problems.push({
        binding: binding.name,
        reason: 'is in the snapshot but this Foundry does not register it',
      });
    }
  }

  return problems;
}

/**
 * ⚠️ The version is reported SEPARATELY from the bindings, and never instead of them.
 *
 * A matching version is not evidence that the bindings match: a patch release can move a key without
 * the number this module reads ever changing, and two installs of the same version could differ if
 * one were modified. So the bindings are always compared, and the version is context for the reader
 * rather than a shortcut past the work.
 */
export function describeVersions(snapshotVersion: string, liveVersion: string): string {
  return snapshotVersion === liveVersion
    ? `snapshot and Foundry are both ${liveVersion}`
    : `⚠️ snapshot was taken from ${snapshotVersion}, this Foundry is ${liveVersion}`;
}
