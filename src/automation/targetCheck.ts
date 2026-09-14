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
 * ⚠️ ANOTHER SCENE MEANS LATER, NOT NO. PF2e applies to controlled tokens, and only tokens on the scene
 * the GM's browser is viewing can be controlled. A GM looking at a different map has not decided
 * anything about this hit, so it stays queued and is tried again when the scene changes.
 */
export interface TargetState {
  /** The token's scene is not the one this browser is viewing. */
  readonly elsewhere: boolean;
  readonly exists: boolean;
  readonly hp: number | null;
  readonly inCombat: boolean;
  readonly playerOwned: boolean;
}

export type TargetVerdict =
  | { readonly kind: 'ok' }
  | { readonly kind: 'later' }
  | { readonly kind: 'deck'; readonly reason: string };

export function checkTarget(state: TargetState): TargetVerdict {
  if (state.elsewhere) {
    return { kind: 'later' };
  }
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
