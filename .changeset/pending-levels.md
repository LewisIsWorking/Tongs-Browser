---
'tongs-browser': minor
---

Pending levels. A script that edits a world while it is closed can now level a PF2e character properly: it writes `flags.tongs-browser.pendingLevel` (a whole number from 1 to 20) on the actor instead of the level itself. When the world is ready, one GM's browser takes each such actor in turn, changes its level the way the sheet would (so PF2e grants that level's class features and asks its choices), sets HP to the new maximum, clears the flag and says "Tongs levelled Name to 7". Lowering a level works too. A value that is not a whole number from 1 to 20 is ignored with a warning, and the flag is cleared even when the level change fails. The flag is also applied when it is set on a running world, and a GM's macro can run it with `game.modules.get('tongs-browser').api.applyPendingLevels()`.
