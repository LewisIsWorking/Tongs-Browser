# src/deck

The GM roll deck: swipe through the chat log one card at a time, with large buttons to apply damage
and roll saves. GM only.

| File                       | What it is                                                                  |
| -------------------------- | --------------------------------------------------------------------------- |
| `deckFacts.ts`             | What the deck knows about one message, extracted from the real one          |
| `buildDeck.ts`             | Which messages are cards, and in what order                                 |
| `applyOptions.ts`          | The five ways to apply damage, and what each button says                    |
| `readMessageFacts.ts`      | A real PF2e/SF2e chat message read into facts, against a measured shape     |
| `applyThroughSystem.ts`    | Making PF2e run its own apply, at the roll target or at groups of targets   |
| `buildApplyPorts.ts`       | The real Foundry behind applying, every method called on its own object     |
| `damageAmounts.ts`         | What each apply button would send, priced by PF2e's own `roll.alter`        |
| `readSaveControls.ts`      | The saves a card asks for, read from PF2e's own save controls in its HTML   |
| `rollSaveThroughSystem.ts` | Rolling a card's save by clicking PF2e's own control for the chosen tokens  |
| `buildSavePorts.ts`        | The real Foundry behind rolling a save                                      |
| `selection.ts`             | Borrowing the GM's token selection and giving it back                       |
| `watchMessages.ts`         | Waiting for PF2e to report, per token, that a hit landed or a save rolled   |
| `listDeckMessages.ts`      | The chat log read into facts: on the document boundary, GM and visible only |
| `RollDeck.ts`              | The deck as one GM-only service, reached as `api.getDeck()`                 |

The panel that shows the deck lives in `panel/`, with its own README.

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

## Saves are rolled by clicking PF2e's own control

Measured on pf2e 8.5.0, 2026-09-13. A spell card's save is `data-action="spell-save"` with `data-save`
and `data-dc`; an enriched `@Check` is `data-pf2-check` with `data-pf2-dc`. Both are in the message's
stored content. Neither message records a target, so the GM chooses who rolls.

- PF2e's handlers for both are private and roll for the SELECTED tokens, so the deck selects the chosen
  tokens, clicks the control on a freshly rendered card, and restores the selection.
- ⛔ The card must be IN the document when clicked: PF2e listens for inline checks on `document`, and a
  detached card's click never reaches it (measured: nothing rolled until it was attached).
- ⛔ Shift is set from the GM's `showCheckDialogs`, or the roll opens a dialog nobody sees.
- Proven live: a Quasit's Fear (Will DC 17) and Quasit Venom (Fortitude DC 17) each rolled a Xorn's save.

## PF2e's own Apply is not a model to copy blindly

Read from PF2e 8.5.0's `applyDamageFromMessage`, 2026-09-13. Stated here rather than pointed to,
because the brief it came from lives outside this repository.

- **It hits the GM's SELECTED tokens**, not the roll's target (`game.user.getActiveTokens()`), except
  on persistent-damage recovery cards. A swipe deck has no selection, which is why decision four above
  exists.
- **It is private to PF2e's bundle** and not on `game.pf2e`, so a module cannot call it.
- ⛔ **Rebuilding it from the public `actor.applyDamage(...)` cannot be 1:1.** It calls
  `extractEphemeralEffects`, which applies effects that depend on WHO deals the damage, and that is
  private too. A rebuild would land some hits wrong with nothing looking wrong.
- ✅ **So the deck makes PF2e run its own apply**: `applyThroughSystem.ts` selects the roll's target,
  runs PF2e's chat context menu entry for that option, and restores the GM's selection. Proven live
  against a Xorn's fire resistance on 2026-09-13.
- For the record, what that apply does: half, double and triple go through
  `roll.alter(multiplier, addend)`, which keeps the damage TYPES and rounds each instance down on its
  own (measured: half of 5 piercing plus 1 fire is 2, not 3); healing is `multiplier * total + addend` with
  `skipIWR: true`; plus a contextual clone with ephemeral effects, troop dedup, `outcome` and
  `shieldBlockRequest`.
