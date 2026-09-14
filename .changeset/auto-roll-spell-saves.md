---
'tongs-browser': minor
---

Optionally roll enemies' saving throws against players' spells without waiting for the GM.

A second world setting, **Auto-roll enemies' saves against players' spells**, is **off** until a GM
turns it on, separately from strike auto-apply. When a player casts a spell with a save, their own
browser records the creatures they had targeted on the spell's card, and the GM's browser rolls those
creatures' saves through PF2e's own save button, with no dialog.

- Only enemies still standing in the running combat roll; a player's allies are skipped.
- Only the spell's own save button is rolled, never an inline check from its description.
- With no full GM connected, the cast is queued and its saves roll when a GM connects, exactly once.

Applying the spell's damage by each creature's degree of success is not part of this release.
