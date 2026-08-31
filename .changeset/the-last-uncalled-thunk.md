---
'tongs-browser': patch
---

Test the haptic thunk, the last uncalled wiring in `ModuleParts`.

It has the longest chain of any of them: a touch starts a timer, the timer fires a long press, the
long press emits a vibrate action, the controller calls the thunk, and the thunk feature-detects
`navigator.vibrate`. Every link is somewhere else, which is why no focused suite reached it.

The feature detection is the point rather than a formality. `lib.dom` declares `navigator.vibrate` as
always present and it is absent on iOS entirely, so an unguarded call would throw inside the long
press handler on every iOS hold - a broken gesture, not a missing buzz. Both the wiring and the guard
fail when mutated.

Also records the 2026-09-01 Android re-run: 16 passed, 3 skipped, 0 failed on a cold booted emulator,
confirming no regression across seven released versions.

`ModuleParts` reaches 95.45% of functions; project coverage to 97.98 statements and 97.98 functions.
