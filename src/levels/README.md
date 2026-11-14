# src/levels

Pending levels: a level a script outside Foundry left on an actor, applied through PF2e by one GM's
browser. Added 2026-11-14.

| File                    | What it is                                                                  |
| ----------------------- | --------------------------------------------------------------------------- |
| `pendingLevel.ts`       | The rules: the flag's shape, which changes set it, what the GM is told      |
| `startPendingLevels.ts` | The queue, the `ready` sweep, the `updateActor` hook and the API's one call |

## Why it is needed

PF2e grants class features, and asks their ChoiceSet questions, only when `system.details.level.value`
changes inside a running Foundry client. A level written straight into a closed world's database grants
nothing. So a script writes the flag instead, and the GM's browser makes the change the way the sheet
would.

## The flag

`flags.tongs-browser.pendingLevel`, a JSON number: a whole number from 1 to 20. Lowering is allowed.
Anything else (a string such as `"7"`, `7.5`, `0`, `21`, `null`) is refused: the GM is warned and the flag
is cleared. The README at the repository root documents it for the scripts that write it.

⚠️ A script must write ONLY the flag and leave `system.details.level.value` as it was. If the level is
already the target, PF2e sees no change and grants nothing; the GM is warned when that happens.

## What happens, per actor, one at a time

1. The level is updated to the flag's value, so PF2e's grant and ChoiceSet flow runs.
2. HP is set to the new maximum, read after the update.
3. The flag is unset, even when the update threw.
4. The GM is told: "Tongs levelled Name to 7", or warned why not.

## Who acts

- **At `ready`, and when `updateActor` sets the flag**, only the designated GM (`game.users.activeGM`),
  so two GMs online level an actor once. The level and HP writes fire `updateActor` too, but only a
  change naming the flag is looked at.
- **`game.modules.get('tongs-browser').api.applyPendingLevels()`**, from any GM's macro. It resolves to
  how many actors were levelled, or null in a player's browser.

Everything waits in one queue, so a flag set while the launch sweep is still waiting on a ChoiceSet
prompt is applied after it, never alongside it.
