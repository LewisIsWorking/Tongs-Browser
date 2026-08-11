---
'tongs-browser': patch
---

Make the device drag check non destructive, and stop it hanging on a backgrounded tab.

Three attempts to run it against the phone produced no output at all, and two of them left a probe
actor and token behind in a live world. Both faults were in the harness.

**It creates nothing now.** Building a probe actor and token is four document writes, and every write
to the phone is a Foundry socket round trip measured in minutes over wireless adb. The check adopts a
token that is already in the scene instead, restores its position afterwards, and so performs exactly
one write: the drag itself, which is the thing under test. The user's own selected token is also a
better subject than anything the check could invent, since it is the one they were dragging when they
hit the bug.

**It no longer waits on `requestAnimationFrame` alone.** rAF does not fire in a background tab, and on
a phone that is not an edge case: the moment you switch to another app, Foundry stops painting and the
drag loop waits forever. It is now raced against a timer, so a backgrounded tab slows the check
instead of stopping it.

The CDP client also names a tab that goes away mid run rather than surfacing a raw WebSocket stack
trace followed by a confusing `ReferenceError` from cleanup running against a dead context.
