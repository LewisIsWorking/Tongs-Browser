# src/automation

Phase 2: players' checked strike damage applied to enemies, and enemies' saves against players' spells
rolled, without waiting for the GM. Each is off per world until a GM turns it on.

| File                      | What it is                                                                 |
| ------------------------- | -------------------------------------------------------------------------- |
| `automationRole.ts`       | Whether this browser acts, leaves it to the GM's browser, or queues        |
| `strikeFacts.ts`          | A strike's attack and damage cards read into facts, against measured cards |
| `validateStrike.ts`       | Whether a damage roll follows a real hit and is possible for its weapon    |
| `targetCheck.ts`          | Whether the target is still an enemy standing in the fight on this scene   |
| `AutoApply.ts`            | Acting, queueing and catching up, around those decisions                   |
| `recentStrikeMessages.ts` | The recent chat log, on the document boundary: GM only, visible only       |
| `buildAutoApply.ts`       | The real Foundry behind `AutoApply`, every method called on its own object |
| `spellFacts.ts`           | A spell's cast card read into facts, and the targets its caster recorded   |
| `SpellSaves.ts`           | Rolling enemies' saves against players' spells, queued while no full GM    |
| `startSpellSaves.ts`      | Its own world setting, recording the caster's targets, and its hooks       |
| `startAutoApply.ts`       | The world setting, and connecting the automation to Foundry's hooks        |

## Decided with Lewis, 2026-09-14

- **Only a full Gamemaster's browser acts.** With no full GM connected, the author's own browser marks
  their damage card pending, and the GM's browser works through the queue when it connects.
- **A hit applies only when it checks out:** the same character's attack on the same target, just
  before, hit or crit; the formula is PF2e's own for that strike; the total is possible for it. Anything
  else waits in the roll deck, with the reason written on the card.
- **Applied once.** Applying goes through `RollDeck.apply`, which refuses a card already handled or
  already under way, so the automation and the GM's own tap cannot both land one hit.

## Measured, not assumed (pf2e 8.5.0)

- A strike's Damage button works with no attack at all, and a MISSED attack's card still rolls damage
  recorded as `outcome: "success"`. Only the attack card says whether it hit.
- The damage card's formula equals `strike.damage({ getFormula: true })`, and the roll exposes
  `minimumValue` and `maximumValue`.
- A player may set flags on a message they authored. One GM user cannot be joined from two browsers.
