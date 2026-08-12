/**
 * Finding "my character" on a phone. Extracted from TongsBrowser 2026-08-12.
 *
 * Deliberately SYSTEM AGNOSTIC. PF2e and SF2e were the worlds this was asked for, but every system
 * renders sheets through the same `Actor#sheet`, so naming one would only make it break on the next.
 */

/** An actor, described only as far as opening a sheet needs. */
export interface SheetOwner {
  readonly isOwner?: boolean;
  readonly sheet?: { render?: (force: boolean) => void };
}

export interface CharacterSources {
  /** The actor the user nominated in their configuration, or null. */
  readonly assigned: () => SheetOwner | null | undefined;
  /** The actor behind the currently controlled token, or undefined. */
  readonly controlled: () => SheetOwner | null | undefined;
  /** Every actor in the world, which is filtered down to the ones this user owns. */
  readonly allActors: () => readonly SheetOwner[];
}

/**
 * Which actor "my character" means, in the order somebody actually means it.
 *
 * The order is the whole content of this function, and each step earns its place:
 *
 * 1. **The assigned character**, because that is what the user explicitly nominated.
 * 2. **A controlled token's actor**, because on a phone selecting a token and then asking for its
 *    sheet is the natural flow: double tapping a token accurately is fiddly, which is the problem
 *    this whole module exists for.
 * 3. **The only actor they own**, which covers the very common case of a player with exactly one
 *    character and no assignment set. Only when there is exactly one, because guessing between two
 *    would open the wrong sheet half the time, and a wrong sheet is worse than no sheet: it looks
 *    like it worked.
 *
 * Returns null rather than throwing when there is nothing, so the caller can say something useful
 * instead of failing silently.
 */
export function resolveCharacterSheet(sources: CharacterSources): SheetOwner | null {
  const assigned = sources.assigned() ?? null;
  if (assigned?.sheet?.render !== undefined) {
    return assigned;
  }

  const controlled = sources.controlled() ?? null;
  if (controlled?.sheet?.render !== undefined) {
    return controlled;
  }

  const owned = sources.allActors().filter((actor) => actor.isOwner === true);
  const only = owned.length === 1 ? owned[0] : undefined;
  return only?.sheet?.render === undefined ? null : only;
}

/** Open the resolved sheet, reporting whether there was one to open. */
export function openCharacterSheet(sources: CharacterSources): boolean {
  const actor = resolveCharacterSheet(sources);
  if (actor?.sheet?.render === undefined) {
    return false;
  }
  actor.sheet.render(true);
  return true;
}
