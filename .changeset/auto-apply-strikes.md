---
'tongs-browser': minor
---

Optionally apply players' checked strike damage to enemies without waiting for the GM.

A new world setting, **Auto-apply players' checked strike damage**, is **off** until a GM turns it on.
When it is on and a full Gamemaster is connected, the GM's browser applies a player's strike damage
to the enemy they targeted, through PF2e's own apply, only when it checks out:

- the same character's attack on that target, just before, hit or crit;
- the damage formula is PF2e's own for that weapon, and the total is possible for it;
- the target is still an enemy with hit points, in the running combat.

Anything that does not check out waits in the GM roll deck, and the card says why. With no full GM
connected, a player's hit is queued, and the GM's browser works through the queue when it connects. A
hit is never applied twice: a card whose automatic apply was interrupted goes to the roll deck to be
checked rather than being applied again. Assistant GMs' browsers never apply.

Spells, saving throws and health bands to Telegram are not part of this release.
