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
 * ⛔ A PLAYER CHARACTER IS NEVER AN ENEMY, OWNED OR NOT (fixed 2026-09-28). The rule once looked only at
 * ownership, and since the move to the self-hosted Foundry every character is unowned until a GM
 * reassigns it: a player's hit on a party member would have been applied as a hit on an enemy.
 *
 * ⭐ ENEMIES' HITS ON PLAYER CHARACTERS (added 2026-09-28, decided with Lewis): `checkPlayerTarget` is the
 * mirror image. The target must be a player character, and "player character" means `type: "character"`,
 * not "owned by a player": since the move to the self-hosted Foundry every character is unowned until a GM
 * reassigns it, and ownership would have made the rule refuse every hit.
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
  /** A player character (`type: "character"`), owned or not. */
  readonly isCharacter: boolean;
}

export type TargetVerdict =
  { readonly kind: 'ok' } | { readonly kind: 'deck'; readonly reason: string };

/** An enemy's hit: the target must be a player character still standing in the fight. */
export function checkPlayerTarget(state: TargetState): TargetVerdict {
  if (!state.exists) {
    return { kind: 'deck', reason: 'the target is no longer on the scene' };
  }
  if (!state.isCharacter) {
    return { kind: 'deck', reason: 'the target is not a player character' };
  }
  return standing(state);
}

function standing(state: TargetState): TargetVerdict {
  if (state.hp === null || state.hp <= 0) {
    return { kind: 'deck', reason: 'the target has no hit points left' };
  }
  if (!state.inCombat) {
    return { kind: 'deck', reason: 'the target is not in a running combat' };
  }
  return { kind: 'ok' };
}

export function checkTarget(state: TargetState): TargetVerdict {
  if (!state.exists) {
    return { kind: 'deck', reason: 'the target is no longer on the scene' };
  }
  if (state.isCharacter) {
    return { kind: 'deck', reason: 'the target is a player character, not an enemy' };
  }
  if (state.playerOwned) {
    return { kind: 'deck', reason: "the target is a player's creature, not an enemy" };
  }
  return standing(state);
}
