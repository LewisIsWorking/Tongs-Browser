---
'tongs-browser': patch
---

Add `npm run check:keybindings`, which requires every keybinding core Foundry registers to say how a
phone reaches it, or to say plainly that it cannot and what that costs.

The target key was found by hand: somebody listed Foundry's bindings, compared them against the
eight on the modifier bar, and noticed that the key deciding who an attack is against was one a
phone could not press. That worked by luck. Nothing recorded what was reachable, so nothing recorded
what was missing either, which is the fault this repo keeps meeting from other directions.

All 37 core bindings from 14.366 are now accounted for: 6 on the bar, 7 on the control pad, 4
through Foundry's own on-screen UI, and 20 not reachable with a note on each saying what a user
cannot do. The guard also fails when a route names a bar key or a tray button that no longer exists,
so the table cannot rot into a confident lie while reading as authoritative.
