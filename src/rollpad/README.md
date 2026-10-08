# src/rollpad

The player's Roll Pad: their character's rolls as big buttons, for phones. Opened from the tray's dice
button, which a player sees in the slot where a GM sees the roll deck.

Lewis, 2026-10-05, after a Discord thread about phones being painful for Foundry: "IT would be good to be
able to roll from Mobile a lot easier."

| File              | What it is                                                                  |
| ----------------- | --------------------------------------------------------------------------- |
| `padModel.ts`     | What the pad offers, read defensively from the PF2e actor                   |
| `padRolls.ts`     | Making PF2e roll what a button names, with its own methods                  |
| `padPress.ts`     | A tap rolls, a long press rolls through PF2e's dialog                       |
| `padViews.ts`     | The buttons on each tab: Strikes, Checks, Skills                            |
| `RollPad.ts`      | The full-screen panel, its tabs, and closing once a roll is made            |
| `buildRollPad.ts` | The real Foundry behind it: "my character" is the tray's sheet button's one |

## Rules

- ⭐ **PF2e rolls, not us.** Each button calls the method PF2e's sheet calls, so the card in chat is
  PF2e's own, with every modifier applied, and the GM's automation treats it as a sheet roll.
- ⚠️ **A tap never opens a dialog, and a long press always does.** `skipDialog` is passed both ways,
  because left out PF2e follows the player's own "show check dialogs" setting.
- ⚠️ **Nothing is cached.** The actor is read on every open and found again by index at the moment of
  rolling, so a weapon drawn while the pad was open rolls as drawn.
- ⚠️ **A scroll never rolls.** A finger that slides off a button, or that the browser takes for a
  scroll, cancels the press.
- ⛔ **Players only.** A GM's tray has the roll deck in the same slot; a GM rolls NPCs from their sheets.
