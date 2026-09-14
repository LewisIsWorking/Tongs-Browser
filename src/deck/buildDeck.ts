import type { MessageFacts } from './deckFacts.js';

/**
 * Which messages are cards in the GM roll deck, and in what order. Added 2026-09-13.
 *
 * All three rules were decided with Lewis on 2026-09-13 rather than chosen here:
 *
 * 1. **Only actionable messages.** Something to apply or a save to roll. Chat, emotes and rolls with
 *    nothing to act on never appear, so every swipe is a decision.
 * 2. **Handled cards drop out.** Read from the shared marker phase 2's automation also checks.
 * 3. **Oldest unhandled first.** Catching up on a play-by-post thread in the order things happened.
 *
 * ⚠️ Pure and synchronous, with no clock and no Foundry, so every rule above is provable at a desk.
 */

/** A message is a card when it has damage to apply or asks for a save. */
export function isActionable(message: MessageFacts): boolean {
  return message.damage.length > 0 || message.saves.length > 0;
}

/**
 * ⚠️ Sorted by timestamp, then by id. Two messages CAN share a millisecond, especially a damage roll
 * posted immediately after the attack that caused it, and `Array.prototype.sort` is not guaranteed to
 * keep equal elements in a stable order across every engine this might run in. A deck whose card
 * order shuffles between two opens reads as the deck losing your place.
 */
function oldestFirst(a: MessageFacts, b: MessageFacts): number {
  if (a.timestamp !== b.timestamp) {
    return a.timestamp - b.timestamp;
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * ⛔ RETURNS A NEW ARRAY and never sorts the caller's. The caller's list is Foundry's own message
 * collection order, and sorting it in place would reorder something the chat log also reads.
 */
export function buildDeck(messages: readonly MessageFacts[]): MessageFacts[] {
  return messages.filter((message) => isActionable(message) && !message.handled).sort(oldestFirst);
}
