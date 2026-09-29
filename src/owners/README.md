# src/owners

Giving players back what they owned before the worlds moved off The Forge.

| File                    | What it is                                                                    |
| ----------------------- | ----------------------------------------------------------------------------- |
| `orphanOwners.ts`       | Finding owner ids that are no longer users, and the updates that hand them on |
| `startRestoreOwners.ts` | The GM's "Restore owners" settings button, its dialog, and applying it        |

## Why anything was "missing"

The move deleted every player's old Foundry user, and ComeOnOverUno made each of them a new one. Their
characters, homebrew items and journals were never touched: each still names the OLD user id as its
owner. That id matches nobody now, so to the player it all looked gone.

## The GM says who is who

The old users' names went with them, and matching by name was ruled out on 2026-09-20 because it can hand
somebody another player's character. So the dialog shows each orphaned owner as what they owned ("Kitt,
Cyrus, Rune, Zels and 14 more"), and the GM picks their new user. Nothing is guessed.

## Nothing is taken away

The new user gets the old user's access, or keeps a higher level they already have. The old id stays in
the document, so running it twice, or changing an answer, is harmless. Answers are saved per world and
shown again next time.

It covers the world's own documents (actors, items, journals, scenes, macros, cards, tables, playlists).
Compendium entries are not owned per user in Foundry, so there is nothing to restore there.
