---
'tongs-browser': minor
---

Add an undo button to the control pad, sending Ctrl+Z as one action.

The keybinding coverage guard added in the previous change named this as the standout gap: undo has
no on-screen equivalent anywhere in Foundry, so a mis-drag could not be undone from a phone at all.
It is also the failure this pointer makes easiest, because a token commits on the drop and the first
you know of a wrong square is once it is already there.

Chords are new. The bar could already do "latch Ctrl, then tap Delete", which is the right shape for
a modifier the user is choosing and the wrong one for a command that is always the same chord: nobody
thinks of undo as control-then-Z. `modifiers/Chord.ts` holds the modifier across the key and releases
after, which is the whole contract and is asserted as an ordered sequence rather than a set of calls.
