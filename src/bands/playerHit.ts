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
 * Pure: the views and the HP remembered before the change are handed in.
 */
export interface PlayerHitPost {
  readonly name: string;
  readonly damage: number;
  readonly hp: number;
  readonly maxHp: number;
  readonly attacker?: string;
  readonly weapon?: string;
  readonly characterImage?: string;
}

/** The hit, without its cause, or null: not a character, not fighting, hidden, or not a loss of HP. */
export function readPlayerHit(
  view: TokenView,
  before: number | undefined
): Omit<PlayerHitPost, 'attacker' | 'weapon'> | null {
  if (
    view.character !== true ||
    !view.inCombat ||
    view.hidden ||
    view.maxHp <= 0 ||
    before === undefined ||
    view.hp >= before
  ) {
    return null;
  }
  const hp = Math.max(0, view.hp);
  return {
    name: view.name,
    damage: before - hp,
    hp,
    maxHp: view.maxHp,
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
