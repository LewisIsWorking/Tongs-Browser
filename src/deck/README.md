# src/deck

The GM roll deck: swipe through the chat log one card at a time, with large buttons to apply damage
and roll saves. GM only.

| File                    | What it is                                                                 |
| ----------------------- | -------------------------------------------------------------------------- |
| `deckFacts.ts`          | What the deck knows about one message, extracted from the real one         |
| `buildDeck.ts`          | Which messages are cards, and in what order                                |
| `applyOptions.ts`       | The five ways to apply damage, and what each button says                   |
| `readMessageFacts.ts`   | A real PF2e/SF2e chat message read into facts, against a measured shape    |
| `applyThroughSystem.ts` | Applying a card by making PF2e run its own apply, aimed at the roll target |
| `buildApplyPorts.ts`    | The real Foundry behind applying, every method called on its own object    |
| `RollDeck.ts`           | The deck as one GM-only service, reached as `api.getDeck()`                |

## Decided with Lewis, 2026-09-13

- **Only actionable cards**: damage to apply or a save to roll.
- **Oldest unhandled first**, for catching up on a play-by-post thread.
- **Handled cards drop out**, using the same marker phase 2's automation checks.
- **Apply hits the roll's target**, named on the button. No target means the button asks.

## Facts, not messages

Nothing in this folder reads a Foundry `ChatMessage`. The deck is decided from `MessageFacts`, which
the system adapter extracts. That keeps what is known about PF2e's message shape in one place, and it
is also why the deck needs no PF2e and SF2e split: the two systems share their damage code and differ
only in the flag namespace (`flags.pf2e` versus `flags.sf2e`), which the adapter reads as
`message.flags[game.system.id]`.

## PF2e's own Apply is not a model to copy blindly

Read from PF2e 8.5.0's `applyDamageFromMessage`, 2026-09-13. Stated here rather than pointed to,
because the brief it came from lives outside this repository.

- **It hits the GM's SELECTED tokens**, not the roll's target (`game.user.getActiveTokens()`), except
  on persistent-damage recovery cards. A swipe deck has no selection, which is why decision four above
  exists.
- **It is private to PF2e's bundle** and not on `game.pf2e`, so a module cannot call it. Applying
  means calling the public `actor.applyDamage(...)` with the arguments assembled the way PF2e does.
- ⛔ **Half, double and triple go through `roll.alter(multiplier, addend)`**, which keeps the damage
  TYPES. Passing `total * 0.5` as a number instead silently skips per-type resistances and weaknesses.
- **Healing is `multiplier * total + addend` with `skipIWR: true`.**
- It also builds a contextual clone with ephemeral effects, dedupes troop tokens, and passes
  `outcome` and `shieldBlockRequest`. Leaving any of these out is not 1:1.
