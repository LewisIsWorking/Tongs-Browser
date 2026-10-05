# src/welcome

New players. A player who joins a world and owns no character sheet is welcomed, asked for a name, and gets
a sheet made for them in the campaign's party. The sheet then opens with a checklist of what PF2e needs
filled in at level 1.

A player cannot create an actor in most worlds, so the sheet is made by a GM's browser. The request travels
as a flag on the player's own User document, which only they (and a GM) can write, so the server already
proves who asked. The answer travels back on the same User.

| File                    | What it is                                                                    |
| ----------------------- | ----------------------------------------------------------------------------- |
| `sheetRequest.ts`       | The request and answer flags, and reading them defensively                    |
| `campaignParty.ts`      | Which party a sheet goes in: the one with a campaign code                     |
| `SheetRequests.ts`      | The GM side: serve each waiting request, once, one pass at a time             |
| `startSheetRequests.ts` | The settings, the hooks that wake the GM side, and the Foundry wiring         |
| `welcomeDocuments.ts`   | Every user and actor listing the welcome makes (a `check:documents` boundary) |
| `startWelcome.ts`       | The player side: which face to show, and the checklist for a new sheet        |
| `WelcomeWindow.ts`      | The welcome window: ask, waiting, and turned down                             |
| `buildGuide.ts`         | The checklist, read from the sheet                                            |
| `GuidePanel.ts`         | The checklist panel                                                           |

## Decided with Lewis, 2026-10-05

- **No GM online: the request waits** and is served the moment a GM joins. With a GM online it is immediate.
- **Welcome, then a guided build**: a window on first visit, then a checklist beside the new sheet.
- **The campaign's party**: the party with a campaign code (`bands/partyCampaign.ts`). With several, the
  player picks; with none, the request waits and the GM is told once.

## Learnings

- ⛔ **Only the designated GM's browser serves** (`game.users.activeGM`). Every GM tab would otherwise
  make its own sheet for the same request.
- ⛔ **One pass at a time.** Answering a player fires `updateUser`, which wakes the GM side again while the
  first pass is still awaiting. A call made mid-pass becomes one more pass, never a second one alongside.
- ⚠️ **The sheet is marked with the request it was made for** (`madeForRequest`). A pass that made the
  sheet and then failed to answer finds it next time and answers with it, rather than making another.
- ⚠️ **The request is cleared and the answer written in ONE update**, so the player never sees both or
  neither. The new sheet becomes their assigned character unless they already have one.
- ⛔ **A sheet counts as the player's only when `isOwner === true`.** A limited view of somebody else's
  sheet must not stop a new player being welcomed.
- ⛔ **PF2e's `ancestry`, `heritage`, `background` and `class` are prototype getters.** Spreading the actor
  drops them, so the checklist's view is built field by field.
- ⚠️ **Inert until a GM gives a party a campaign code.** The GM side shares the campaign parties in a
  hidden world setting, because a player cannot see a party they are not in.
