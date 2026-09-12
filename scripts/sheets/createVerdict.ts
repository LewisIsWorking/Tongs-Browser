/**
 * Judging a sheet the create button actually made, in a real world. Added 2026-09-12.
 *
 * ⛔ WHY THIS IS SEPARATE FROM `check:sheets`. That check promises it writes nothing to the world,
 * and keeps the promise by declining to press create wherever pressing would write. This is the
 * other half: it DOES press, judges what was made, and removes it. Folding it into the first check
 * would break a promise that check makes out loud.
 *
 * ⚠️ Pure, so every verdict can be proven at a desk. The live script only gathers facts and deletes.
 *
 * ⚠️ The expected values are PASSED IN rather than imported from `src/`. No script in this repo
 * imports module source, because module source expects a browser and Foundry's globals; the live
 * script reads the owner level from the running Foundry's own `CONST` instead, which is also better
 * evidence than a number copied into a test.
 */

/**
 * Which actors appeared between two snapshots of the world.
 *
 * ⛔ THE ONLY SAFE WAY TO FIND WHAT TO DELETE. Finding the new sheet by NAME would match any existing
 * character that happens to share the default name, and the cleanup would then delete a real
 * player's sheet. Diffing ids taken before and after the press can only ever return actors that did
 * not exist before it, so nothing that was already in the world is ever a candidate.
 */
export function newActorIds(before: readonly string[], after: readonly string[]): string[] {
  const existed = new Set(before);
  return after.filter((id) => !existed.has(id));
}

/** What the live script reads off the actor that was created. */
export interface CreatedActorFacts {
  readonly type: string;
  /** The folder id, or null when the actor sits at the root. */
  readonly folder: string | null;
  /** Whether the party's own `system.details.members` lists this actor's uuid. */
  readonly inParty: boolean;
  /** The ownership level the intended owner holds on it. */
  readonly ownerLevel: number | undefined;
}

export interface Expected {
  readonly type: string;
  readonly ownerLevel: number;
}

export interface Verdict {
  readonly name: string;
  readonly passed: boolean;
  readonly detail: string;
}

/**
 * ⚠️ Takes the COUNT of new actors separately from the facts, because "exactly one was made" is its
 * own claim. A press that made two sheets would still produce facts for the first one, and every
 * other verdict here could pass on it.
 */
export function judgeCreatedSheet(
  created: number,
  facts: CreatedActorFacts | null,
  expected: Expected
): Verdict[] {
  const verdicts: Verdict[] = [
    {
      name: 'one tap made exactly one sheet',
      passed: created === 1,
      detail: `${String(created)} new actor(s) appeared`,
    },
  ];

  if (facts === null) {
    return verdicts;
  }

  verdicts.push(
    {
      name: `the sheet is a ${expected.type}`,
      passed: facts.type === expected.type,
      detail: `type is '${facts.type}'`,
    },
    {
      name: 'the sheet joined the party',
      passed: facts.inParty,
      detail: facts.inParty
        ? "listed in the party's members"
        : "NOT in the party's members, so it was created but never added",
    },
    /*
     * ⛔ THE CLAIM THAT HAD ONLY EVER BEEN READ, NEVER SEEN. PF2e's `addMembers` does
     * `await e.update({ folder: null, ...t })`, confirmed from its source on 2026-09-10. Until this
     * check nothing had watched it happen to a real actor, so it was a reading of code rather than a
     * measured behaviour.
     *
     * ⛔ ONLY MEANINGFUL IF IT JOINED. A brand new actor created with no folder ALSO has a null
     * folder, so a null folder on a sheet that never reached the party proves nothing about
     * `addMembers`. The first live run printed "PASS folder is null" beside "NOT in the party", and
     * that PASS was a coincidence dressed as evidence. It now refuses to pass what it did not see.
     */
    {
      name: 'joining the party took the sheet out of any folder',
      passed: facts.inParty && facts.folder === null,
      detail: !facts.inParty
        ? 'cannot judge: the sheet never joined the party, and a new actor has no folder anyway'
        : facts.folder === null
          ? 'folder is null after joining'
          : `still in folder ${facts.folder}`,
    },
    {
      name: 'the intended owner can open it',
      passed: facts.ownerLevel === expected.ownerLevel,
      detail: `owner level is ${String(facts.ownerLevel)}, expected ${String(expected.ownerLevel)}`,
    }
  );

  return verdicts;
}
