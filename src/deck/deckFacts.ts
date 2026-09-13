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
