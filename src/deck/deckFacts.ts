/**
 * What the GM roll deck knows about one chat message. Added 2026-09-13.
 *
 * ⛔ FACTS, NOT MESSAGES. Everything the deck decides is decided from these, and these are extracted
 * from a real ChatMessage by the system adapter. Two reasons that seam matters:
 *
 * 1. The shape of a PF2e damage message was not fully known when this was written. Reading the source
 *    showed the item-damage context records who rolled but NO target, while check rolls do record
 *    one. Deciding the deck from a guessed message shape would bake that guess into the ordering and
 *    the labels. Facts keep the guess in one file, the adapter, which a live roll then settles.
 * 2. PF2e and SF2e store these under different flag namespaces (`flags.pf2e` / `flags.sf2e`) and are
 *    otherwise the same code. The adapter reads `message.flags[game.system.id]`; nothing here has to.
 */

/** One damage roll on a message. A message can carry more than one. */
export interface DamageFacts {
  /** Which roll on the message this is, as PF2e numbers them (`rollIndex`). */
  readonly rollIndex: number;
  readonly total: number;
  /** Damage types in the roll, such as `fire` or `slashing`. Empty when untyped. */
  readonly types: readonly string[];
}

/** The saving throw a message asks for. */
export interface SaveFacts {
  readonly statistic: 'fortitude' | 'reflex' | 'will';
  /** The DC, or null when the message asks for a save without stating one. */
  readonly dc: number | null;
}

/** The token a roll was aimed at, as far as a button needs to name it. */
export interface TargetFacts {
  readonly tokenUuid: string;
  /** The name to SHOW, which is not necessarily the actor's real name. */
  readonly name: string;
}

export interface MessageFacts {
  readonly id: string;
  /** Milliseconds since the epoch, from the message's own timestamp. */
  readonly timestamp: number;
  readonly damage: readonly DamageFacts[];
  readonly save: SaveFacts | null;
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
}
