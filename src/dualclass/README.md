# src/dualclass

A player gives one of their characters two classes, PF2e's Dual Class variant. Lewis, 2026-10-12, sharing a
community macro: "The BASED dual class macro that everyone needs to be able to run across all of the worlds,
we should build it into TONGS".

The macro made a world Item, which a player cannot do, so it needed a GM. Here a player presses **Dual class…**
in the Tongs tray (the `C×2` button), picks one of their own sheets and two classes, and the request travels as
the welcome's sheet request does (`src/welcome`): a flag on the player's own User, answered by the designated
GM's browser on the same User. The GM is told "Tongs gave Lai's Kibwe the Fighter - Wizard dual class."

| File                      | What it is                                                                     |
| ------------------------- | ------------------------------------------------------------------------------ |
| `buildDualClass.ts`       | The macro, ported: two classes in, one dual class item out (pure)              |
| `classFields.ts`          | Safe reads and merges over a class's `system` for that port                    |
| `dualClassRequest.ts`     | The request and answer flags, read defensively, and the class compendium list  |
| `DualClassRequests.ts`    | The GM side: check, build and answer each request, once, one pass at a time    |
| `dualClassDocuments.ts`   | The GM's user and actor reads (a `check:documents` boundary)                   |
| `startDualClass.ts`       | Both sides started at `ready`, and the GM side's Foundry wiring                |
| `startDualClassPlayer.ts` | The player side: open the window, send the request, land the answer            |
| `classChoices.ts`         | The classes offered, from this world's class compendiums, and the variant note |
| `DualClassWindow.ts`      | The window: which sheet, 1st and 2nd class, then on its way, done or why not   |
| `landDualClass.ts`        | Putting the item on the sheet, in the player's browser, leaving one class      |

## Decided with Lewis, 2026-10-12

- **Built into Tongs**, in every PF2e and SF2e world. ComeOnOverUno adds the macro itself to every world too.
- **The macro's class compendiums**, in its order, skipping any this world lacks; `sf2e.classes` added so an
  SF2e world has classes to offer at all.
- **Its hint stays**: Kineticist must be the 1st class, and probably Inventor and Thaumaturge too.

## Learnings

- ⛔ **Only the designated GM's browser serves, one pass at a time**, as `SheetRequests` does. The answer
  fires `updateUser`, which calls the GM side again mid-pass; that becomes one more pass, never two at once.
- ⛔ **Every check is made on the GM's side**, not only in the window: any player can write the flag. The sheet
  must exist and be the asker's (Foundry's OWNER level), both classes must come from a listed class compendium
  this world has, and they must be two different classes (by UUID, then by name).
- ⭐ **The item lands from the PLAYER's browser.** PF2e asks a class's choices (the Fighter's skill, the
  Wizard's school) on the screen of whoever adds it, as the welcome measured live. Added by a GM's browser,
  the GM would answer the player's choices, and COO's hidden helper GM would wait on a dialog nobody sees. A
  player may add items to a sheet they own, so the GM's browser only checks, builds and answers.
- ⭐ **PF2e replaces the old class itself** (`ItemPF2e.createDocuments` deletes the actor's class, and the
  features it granted, before creating one). Tongs then makes sure exactly ONE class is left, and the item
  carries `dualClassFor` so a second tab or a reload never adds it twice.
- ⛔ **Three of the macro's lines were wrong, and are fixed** (each marked in `buildDualClass.ts`): medium armour
  compared `class2.heavy > medium`, a typo that dropped a Wizard - Ranger's medium armour; the martial rule
  clean-up spliced inside `forEach`, which skipped the rule after each one removed; and `rules.includes`
  compared objects by identity, so a rule both classes carry was added twice.
- ⚠️ **PF2e has no Dual Class variant setting** (checked against its `variant-rules.ts`, 2026-10-12: gradual
  boosts, stamina, free archetype, ABP, mythic, proficiency). The window says so politely only if a
  `<system>.dualClassVariant` setting is registered and off, so on today's PF2e it says nothing.
