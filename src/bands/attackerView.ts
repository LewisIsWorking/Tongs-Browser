import { allCombatants } from '../automation/tokenCombats.js';
import { UNSEEN, imageUrl, nameRules } from './bandTokens.js';
import type { BandGlobals, TokenDocLike } from './bandTokens.js';

/**
 * Whether the players may be told who dealt a hit, and with which picture. Added 2026-09-15.
 *
 * ⛔ DECIDED WITH LEWIS, 2026-09-15: the combat topic names the weapon and the attacker ("Turret Disintegrator
 * from Changer") WHEN THE PLAYERS CAN SEE THE ATTACKER. Otherwise the line is the band alone, because naming a
 * hidden sniper, or a creature players only know as "The creature", tells the table something it has not
 * earned.
 *
 * Seen means all of: the attacker is not under PF2e's invisible, undetected or unnoticed conditions; its token,
 * when it has one, is not hidden by the GM; and its name is one players can read, by PF2e's own rule
 * (`playersCanSeeName || !nameVisibility`), or it is a player's own creature. An attacker with no token in any
 * encounter counts only when a player owns it: a player's character acting from off the map is still known to
 * the table, an unplaced monster is not.
 *
 * ⚠️ The token is found through every encounter (`automation/tokenCombats.ts`), not the scene the GM views.
 */
export interface SeenAttacker {
  readonly name: string;
  readonly image: string | null;
}

interface AttackerActor {
  readonly name?: string;
  readonly img?: string | null;
  readonly isToken?: boolean;
  readonly token?: TokenDocLike | null;
  readonly hasPlayerOwner?: boolean;
  readonly prototypeToken?: { readonly texture?: { readonly src?: string | null } | null } | null;
  hasCondition?(slug: string): boolean;
}

export interface AttackerGlobals extends BandGlobals {
  readonly fromUuidSync?: (uuid: string) => unknown;
}

const lookup = (globals: AttackerGlobals, uuid: string): AttackerActor | null => {
  try {
    return (globals.fromUuidSync?.(uuid) as AttackerActor | null | undefined) ?? null;
  } catch {
    return null;
  }
};

export function readSeenAttacker(globals: AttackerGlobals, actorUuid: string): SeenAttacker | null {
  const actor = lookup(globals, actorUuid);
  if (actor === null) {
    return null;
  }
  const token =
    actor.isToken === true
      ? (actor.token ?? null)
      : (allCombatants(globals)
          .map(({ combatant }) => combatant.token)
          .find((each) => each?.actor === actor) ?? null);
  const owned = actor.hasPlayerOwner === true;
  if (
    UNSEEN.some((slug) => actor.hasCondition?.(slug) === true) ||
    token?.hidden === true ||
    (token === null && !owned) ||
    !(owned || token?.playersCanSeeName === true || !nameRules(globals).nameVisibility)
  ) {
    return null;
  }
  return {
    name: token?.name ?? actor.name ?? 'someone',
    image: imageUrl(
      token?.texture?.src ?? actor.prototypeToken?.texture?.src ?? actor.img,
      globals
    ),
  };
}
