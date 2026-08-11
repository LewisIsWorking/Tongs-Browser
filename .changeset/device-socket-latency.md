---
'tongs-browser': patch
---

Wait far longer for a token move to commit when the check is driving a real device.

Measured 2026-08-11: a document write issued to the phone took **minutes** to come back through
Foundry's socket, long enough that a desktop client deleted the same token first and the phone's call
eventually returned `Token ... does not exist!`. Pure JavaScript evaluated on that same tab returned
instantly, so this is not a slow device or a suspended tab, it is specifically the round trip through
Foundry's socket over wireless adb.

The eight second commit wait is right for a local desktop client and badly wrong there. It would have
reported "the token did not move" about a move that was merely still in flight, which is the harness
accusing the feature for its own reasons. That has now happened three times in this one check: it
pressed off screen, it read a token mid animation, and this would have been the third.
