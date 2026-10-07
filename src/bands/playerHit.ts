import type { PublicCause } from './bandCause.js';
import type { TokenView } from './bandSubject.js';

/**
 * Whether an HP change on a token is a hit on a player character worth telling the table. Added 2026-09-28.
 *
 * ⭐ DECIDED WITH LEWIS, 2026-09-28: when a player character takes damage in a fight, the campaign's combat
 * topic hears "Arktos takes 12 from Captain Vex's cutlass. 31/43 HP", with the character's picture.
 *
 * ⛔ THE EXACT NUMBERS ARE PUBLIC HERE, unlike an enemy's band: a player character's HP is the table's own
 * business. Who dealt it is still told only when players can see the attacker (`attackerView.ts`).
 *
 * ⚠️ "Player character" is `type: "character"`, never "owned by a player": since the move to the
 * self-hosted Foundry every character is unowned until a GM reassigns it.
 *
 * ⚠️ STAMINA COUNTS (2026-10-07): with PF2e's Stamina variant a hit spends Stamina Points first, so the
 * damage is the fall in HP and SP together, and the post carries the SP left beside the HP.
 *
 * Pure: the views and the health remembered before the change are handed in.
 */

/** A character's health as remembered before a change: HP, and Stamina Points (0 without the variant). */
export interface Health {
  readonly hp: number;
  readonly sp: number;
}

/** The health a view shows now. */
export function healthOf(view: TokenView): Health {
  return { hp: view.hp, sp: view.sp ?? 0 };
}
export interface PlayerHitPost {
  readonly name: string;
  readonly damage: number;
  readonly hp: number;
  readonly maxHp: number;
  /** Stamina Points left and their max, only when the character has a Stamina pool. */
  readonly sp?: number;
  readonly maxSp?: number;
  readonly attacker?: string;
  readonly weapon?: string;
  readonly characterImage?: string;
}

/** The hit, without its cause, or null: not a character, not fighting, hidden, or no loss of HP and SP. */
export function readPlayerHit(
  view: TokenView,
  before: Health | undefined
): Omit<PlayerHitPost, 'attacker' | 'weapon'> | null {
  if (
    view.character !== true ||
    !view.inCombat ||
    view.hidden ||
    view.maxHp <= 0 ||
    before === undefined
  ) {
    return null;
  }
  const hp = Math.max(0, view.hp);
  const sp = Math.max(0, view.sp ?? 0);
  const damage = before.hp + before.sp - (hp + sp);
  if (damage <= 0) {
    return null;
  }
  const maxSp = view.maxSp ?? 0;
  return {
    name: view.name,
    damage,
    hp,
    maxHp: view.maxHp,
    ...(maxSp > 0 ? { sp, maxSp } : {}),
    ...(view.image === null ? {} : { characterImage: view.image }),
  };
}

/** Who hit it and with what, when players may know; nothing at all for a manual change. */
export function withCause(
  hit: Omit<PlayerHitPost, 'attacker' | 'weapon'>,
  shown: PublicCause | null
): PlayerHitPost {
  return {
    ...hit,
    ...(shown === null ? {} : { attacker: shown.attacker.name }),
    ...(shown?.item ? { weapon: shown.item } : {}),
  };
}
