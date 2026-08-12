---
'tongs-browser': patch
---

Extract pausing the world into `foundry/PauseControl.ts`, at 100% coverage.

The hard part was never the toggle, it is **who may broadcast it**, and that is the kind of thing
worth pinning with a test rather than a comment. Foundry's `Game#togglePause` only emits its socket
message `if ( options.broadcast && game.user.isGM )`, so a player calling it toggles their own client
and nobody else's. The check is on the EMIT path rather than on permissions, which is why granting a
player ownership of a macro does not help.

The test that matters most guards a mistake that would be invisible with one GM at the table:

> **`activeGM`, not `isGM`.** Foundry designates the same single GM on every client,
> deterministically. Using "am I a GM" would have EVERY connected GM answer the same relayed request,
> flipping the pause once per GM and landing wherever the race ended. With two GMs online that is a
> button that does nothing half the time, which is worse than one that never works at all.

Also pinned: a macro the user is not permitted to run relays instead of being attempted, because
trying anyway throws inside Foundry and produces nothing where the relay would have worked.

`TongsBrowser.ts` is down from 1,853 to 1,333, with ten new modules all under 200 lines and all at
100% on statements, branches, functions and lines.
