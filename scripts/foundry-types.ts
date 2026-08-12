/**
 * Foundry's page objects, described once. Extracted 2026-08-12.
 *
 * ⚠️ These were previously written TWICE, once in `foundry-android-check` and once inside a nested
 * scope in `foundry-play-probe`, and the two had already drifted: one knew about `nameplate` and not
 * `w`/`h`, the other the reverse, and both were shadowed at individual call sites by ad hoc inline
 * shapes like `{ name: string; id: string; document: { x: number; y: number } }` that omitted `hover`
 * entirely. Reading `token.hover` through one of those was a compile error against a field that has
 * always existed, so the annotation was not describing Foundry, it was describing whatever the author
 * happened to need three lines earlier.
 *
 * That is the failure mode the `foundry-globals.d.ts` header names: a half accurate interface says
 * "checked" and is not. The answer is not to widen these back to `any`, because the harness genuinely
 * does depend on these specific fields and a typo in one is a check that silently reads `undefined`.
 * The answer is ONE description, so drift between copies is not expressible.
 *
 * Still deliberately PARTIAL. Foundry ships no types and its surface is enormous. Everything here is
 * a field this harness actually reads, and nothing is here speculatively.
 */

/** A point in scene coordinates. */
export interface ScenePoint {
  x: number;
  y: number;
}

/**
 * A placed token, as the checks read it.
 *
 * `w`/`h` are the rendered size in scene units, which is NOT `document.width`: the document carries
 * a size in GRID SQUARES and the object carries pixels. A hit test written against the document's
 * width silently tests a box one grid square across, which on a 100px grid is a 99% miss.
 */
export interface FoundryToken {
  id: string;
  name: string;
  center: ScenePoint;
  w: number;
  h: number;
  /** Foundry's own hover flag, the thing the pointer is supposed to be able to set. */
  hover?: boolean;
  nameplate?: { visible?: boolean };
  actor?: { id?: string; name?: string } | null;
  document: ScenePoint & { update: (data: unknown) => Promise<unknown> };
  control: (options?: { releaseOthers?: boolean }) => void;
}

/**
 * What `createProbeTokens` leaves behind in a live world, or null when it could not make one.
 *
 * Both ids are carried because both must be deleted: removing the tokens and leaving the actor is
 * the failure that has already happened twice, and it leaves a `[probe]` actor in somebody's real
 * world where it reads as a mysterious NPC rather than as harness debris.
 */
export interface TokenProbe {
  actorId: string;
  tokenIds: string[];
}
