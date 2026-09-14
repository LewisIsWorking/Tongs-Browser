/**
 * What the GM roll deck knows about one chat message. Added 2026-09-13.
 *
 * ⛔ FACTS, NOT MESSAGES. Everything the deck decides is decided from these, and these are extracted
 * from a real ChatMessage by the system adapter. Two reasons that seam matters:
 *
 * 1. The shape of a PF2e damage message is read by the adapter, not assumed here. Reading the bundle
 *    alone was inconclusive: the item-damage builder records no target, check rolls do. A REAL strike
 *    settled it on 2026-09-13 (pf2e 8.5.0, a Fire Mephit's Jaws against a Xorn): the damage message
 *    records `flags.pf2e.context.target = { actor, token }` as UUIDs, with `type: "damage-roll"`,
 *    `sourceType: "attack"` and an `outcome`. A roll made with nothing targeted has no target, which
 *    is the "ask the GM" case, not a missing field.
 * 2. PF2e and SF2e store these under different flag namespaces (`flags.pf2e` / `flags.sf2e`) and are
 *    otherwise the same code. The adapter reads `message.flags[game.system.id]`; nothing here has to.
 */

import type { DamageAmounts } from './damageAmounts.js';

/** One damage roll on a message. A message can carry more than one. */
export interface DamageFacts {
  /** Which roll on the message this is, as PF2e numbers them (`rollIndex`). */
  readonly rollIndex: number;
  readonly total: number;
  /** Damage types in the roll, such as `fire` or `slashing`. Empty when untyped. */
  readonly types: readonly string[];
  /** What each apply option would send, as PF2e prices it. An option it could not price is absent. */
  readonly amounts: DamageAmounts;
}

export type SaveStatistic = 'fortitude' | 'reflex' | 'will';

/**
 * Which of PF2e's own controls asks for the save. Measured 2026-09-13 on pf2e 8.5.0:
 *
 * - `spell-save`: the button on a spell card, `data-action="spell-save" data-save="will" data-dc="17"`
 *   (a Quasit casting Fear).
 * - `inline-check`: an enriched `@Check`, `data-pf2-check="fortitude" data-pf2-dc="17"` (Quasit Venom).
 *
 * Both were in the message's STORED content, not only in its rendered HTML.
 */
export type SaveControlKind = 'spell-save' | 'inline-check';

/** One saving throw a message asks for. A message can ask for more than one. */
export interface SaveFacts {
  readonly statistic: SaveStatistic;
  /** The DC, or null when the control does not state a number (a DC taken from the target, say). */
  readonly dc: number | null;
  readonly control: SaveControlKind;
  /**
   * ⛔ Which control of that kind this is, counted over EVERY control of the kind in document order,
   * including ones that are not saves (an inline Athletics check, say). Rolling clicks exactly that
   * control, so skipping non-saves while counting would click the wrong one.
   */
  readonly index: number;
}

/** The token a roll was aimed at, as far as a button needs to name it. */
export interface TargetFacts {
  /**
   * ⛔ A TOKEN, not an actor. Measured 2026-09-13: a bestiary target's recorded actor is
   * `Scene.X.Token.Y.Actor.Z`, the unlinked token's own synthetic actor. Damage has to land on THAT
   * actor; applying to the world actor of the same name would change a creature not on the scene.
   * PF2e's own apply does the same, iterating tokens and using each token's `actor`.
   */
  readonly tokenUuid: string;
  /** The name to SHOW, which is not necessarily the actor's real name. */
  readonly name: string;
}

export interface MessageFacts {
  readonly id: string;
  /** Who posted it, as the chat log shows them. */
  readonly speaker: string;
  /** The item it came from, such as a strike or a spell, or null when there is none. */
  readonly title: string | null;
  /** Milliseconds since the epoch, from the message's own timestamp. */
  readonly timestamp: number;
  readonly damage: readonly DamageFacts[];
  readonly saves: readonly SaveFacts[];
  /**
   * ⚠️ NULL IS AN ANSWER, not a missing field. Decided 2026-09-13: Apply hits the roll's target, and a
   * card with no recorded target asks the GM to pick one. It must never guess, and never fall back to
   * the GM's selection the way PF2e's own button does.
   */
  readonly target: TargetFacts | null;
  /**
   * ⛔ The SAME record phase 2's automation checks before applying, decided 2026-09-13. One marker,
   * read by both, so the deck and the automation can never both apply one hit.
   */
  readonly handled: boolean;
  /** Why phase 2's automation did not apply this card itself, when it tried. */
  readonly note?: string;
}
