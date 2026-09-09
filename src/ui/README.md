# src/ui

| File                     | What it is                                                     |
| ------------------------ | -------------------------------------------------------------- |
| `TrayActions.ts`         | The handler contract, and which buttons are gated behind what  |
| `TrayActionList.ts`      | Every button the tray can show, as a flat list                 |
| `MapBuildingButtons.ts`  | The GM map-building cluster: select, cut, copy, paste, restack |
| `CreateSheetFlow.ts`     | Walking a user through making a character sheet                |
| `CreateSheetRoute.ts`    | Whether a create goes direct or through the relay              |
| `CreateSheetMessages.ts` | What the create flow says, as data                             |
| `PartyAccessFlow.ts`     | Choosing which parties players may add characters to           |
| `ChoiceMenu.ts`          | The pick-one-of-these list those flows are built from          |

> ⚠️ **This table listed ONE of eight files until 2026-09-09, and said "One file" in prose.** Six
> modules had been added since it was written and none of them appeared here. An incomplete contents
> table is worse than no table: it answers "what is in this folder" wrongly and stops the search,
> while reading as authoritative. `check-folder-readmes.ts` enforces that a README EXISTS, not that it
> is true, so this is a habit rather than a gate. **If you add a file here, add its row.**

Kept apart from `src/modifiers` on purpose: the tray's **contents** are a list that changes often,
while the bar that renders them is machinery that changes rarely. Separating them means adding an
action does not touch the rendering, and the list is reviewable on its own.

## Each action names what pressing it will do

Grab and drop are separate entries rather than one toggle, because a control whose label does not
change cannot tell you which state it is in. On a tablet, where there is no hover and no cursor to
inspect, a control that looks identical in both states is a control whose effect is invisible until
you commit to it.
