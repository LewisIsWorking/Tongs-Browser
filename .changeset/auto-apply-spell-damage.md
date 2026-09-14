---
'tongs-browser': minor
---

Optionally apply players' basic-save spell damage to enemies by each one's degree of success.

A third world setting, **Auto-apply players' basic-save spell damage**, is **off** until a GM turns it
on, separately from rolling the saves. When a player rolls damage for a spell with a basic save, and
every creature they targeted has rolled its save, the GM's browser applies the damage through PF2e's own
apply: half on a success, full on a failure, double on a critical failure, none on a critical success.

- Only when the damage follows a cast of that spell at the same rank, its formula is PF2e's own for that
  rank, and its total is possible. Anything else waits in the roll deck, saying why.
- Only enemies still standing in the running combat; a spell that caught an ally waits for the GM.
- Damage rolled before the saves waits for them, and is applied once the last save arrives.
- With no full GM connected, the damage is queued and applied when a GM connects, exactly once.
