# src/automation

Phase 2: players' checked strike damage applied to enemies, enemies' saves against players' spells
rolled, and those spells' basic-save damage applied by degree of success, without waiting for the GM.
Each is off per world until a GM turns it on.

| File                      | What it is                                                                   |
| ------------------------- | ---------------------------------------------------------------------------- |
| `automationRole.ts`       | Whether this browser acts, leaves it to the GM's browser, or queues          |
| `strikeFacts.ts`          | A strike's attack and damage cards read into facts, against measured cards   |
| `validateStrike.ts`       | Whether a damage roll follows a real hit and is possible for its weapon      |
| `tokenCombats.ts`         | The encounters a token is in, searched across all of them, not the tracker's |
| `targetCheck.ts`          | Whether the target is still an enemy standing in the fight on this scene     |
| `AutoApply.ts`            | Acting, queueing and catching up, around those decisions                     |
| `recentStrikeMessages.ts` | The recent chat log, on the document boundary: GM only, visible only         |
| `buildAutoApply.ts`       | The real Foundry behind `AutoApply`, every method called on its own object   |
| `spellFacts.ts`           | A spell's cast card read into facts, and the targets its caster recorded     |
| `SpellSaves.ts`           | Rolling enemies' saves against players' spells, queued while no full GM      |
| `startSpellSaves.ts`      | Its own world setting, recording the caster's targets, and its hooks         |
| `spellDamageFacts.ts`     | A spell's damage card and its targets' save cards read into facts            |
| `validateSpellDamage.ts`  | Whether spell damage follows a cast and fits it, grouped by each save        |
| `SpellDamage.ts`          | Applying basic-save spell damage by degree, queued while no full GM          |
| `startSpellDamage.ts`     | Its own world setting, the spell's rule at its cast rank, and its hooks      |
| `startAutoApply.ts`       | The world setting, and connecting the automation to Foundry's hooks          |

## Decided with Lewis, 2026-09-14

- **Only a full Gamemaster's browser acts.** With no full GM connected, the author's own browser marks
  their damage card pending, and the GM's browser works through the queue when it connects.
- **A hit applies only when it checks out:** the same character's attack on the same target, just
  before, hit or crit; the formula is PF2e's own for that strike; the total is possible for it. Anything
  else waits in the roll deck, with the reason written on the card.
- **Applied once.** Applying goes through `RollDeck.apply`, which refuses a card already handled or
  already under way, so the automation and the GM's own tap cannot both land one hit.
- **Spells:** the caster's browser records its targets on the cast card, the GM's browser rolls the
  enemies' saves, then applies a basic save's damage to each by its degree of success when the total
  fits: half on a success, full on a failure, double on a critical failure, none on a critical success.

## Measured, not assumed (pf2e 8.5.0)

- A strike's Damage button works with no attack at all, and a MISSED attack's card still rolls damage
  recorded as `outcome: "success"`. Only the attack card says whether it hit.
- The damage card's formula equals `strike.damage({ getFormula: true })` only when no damage depends on
  the target, and the roll exposes `minimumValue` and `maximumValue`.
- ⛔ `getFormula` is view only and drops the target (sf2e 1.5.0, 2026-09-16). An operative's Aim die needs
  `target:mark:aim`, so an aimed hit read `2 * (1d4 + 2) cold` against a card of `2 * (1d4 + 2 + 2d4) cold`
  and was declined. `strike.critical({ createMessage: false, target })` rolls no card and gives the
  card's own formula, so that is what a hit is checked against.
- A player may set flags on a message they authored. One GM user cannot be joined from two browsers.
- A heightened spell's damage depends on its cast rank: rank 5 Vampiric Feast rolls 10d6, which
  `loadVariant({ castRank: 5 }).getDamage()` gives, while `getDamage()` on the base spell gives 6d6.
  Every spell card carries the rank on `flags.pf2e.origin.castRank`.
- PF2e's Half entry with two tokens selected halves the damage for each and posts one `damage-taken` per
  token. Applying one card to a second target afterwards is refused, because the card is handled.
- A rerolled save deletes the old save card and posts a new one marked `isReroll`.
