/**
 * Whether a validated hit's target should still take it without the GM. Added 2026-09-14.
 *
 * From the phase 2 brief: a queued hit can be hours old, and the target may have died, fled, been
 * healed, or the fight may be over. Apply only if it still exists, still has HP, and is still in the
 * combat. Anything else goes to the roll deck. Never apply blindly to a target that has changed.
 *
 * ⛔ ENEMIES ONLY. Phase 2 automates players' actions against enemies. A hit on a creature a player
 * owns, a friendly fire or a mis-targeted ally, always waits for the GM.
 *
 * ⚠️ ANY SCENE (since 2026-09-15). A hit on a token on another scene used to wait until the GM viewed
 * that map, because PF2e applied to controlled tokens. The deck now aims PF2e at the token document
 * itself (`deck/aimAt.ts`), so which map the GM is looking at decides nothing.
 */
export interface TargetState {
  readonly exists: boolean;
  readonly hp: number | null;
  readonly inCombat: boolean;
  readonly playerOwned: boolean;
}

export type TargetVerdict =
  { readonly kind: 'ok' } | { readonly kind: 'deck'; readonly reason: string };

export function checkTarget(state: TargetState): TargetVerdict {
  if (!state.exists) {
    return { kind: 'deck', reason: 'the target is no longer on the scene' };
  }
  if (state.playerOwned) {
    return { kind: 'deck', reason: "the target is a player's creature, not an enemy" };
  }
  if (state.hp === null || state.hp <= 0) {
    return { kind: 'deck', reason: 'the target has no hit points left' };
  }
  if (!state.inCombat) {
    return { kind: 'deck', reason: 'the target is not in a running combat' };
  }
  return { kind: 'ok' };
}
