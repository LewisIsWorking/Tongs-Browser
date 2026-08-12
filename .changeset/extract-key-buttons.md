---
'tongs-browser': patch
---

Extract the modifier keys into `modifiers/KeyButtons.ts` at 100% coverage. `ModifierBar.ts` drops
from 391 to 270, and is now a bar that arranges things rather than one that also implements them.

A key here has **three** states rather than two, which is the whole design: off, latched for the next
action only, and locked until tapped off. Sticky keys are how a one finger user reaches shift-click
at all, and two states would force a choice between "cannot chord" and "silently still held ten
minutes later".

The new suite pins the parts that only a test can see:

- **`data-latch` as well as the class.** `aria-pressed` is a boolean and cannot say which of latched
  or locked a key is in, and those differ in exactly the thing a user needs to predict: one survives
  the next action and one does not.
- **Diffing rather than replaying.** Re-pressing an already held key sends a duplicate keydown, and
  Foundry reads a repeated keydown as auto repeat, so a held Shift would arrive as a stream of
  repeats. The latched to locked step now provably presses nothing.
- **A momentary key consumes LATCHED and leaves LOCKED held**, which is what those two words mean.

The compiler caught a real hazard during the move: `KeyButtons` was first written as a field
initialiser reading `this.options`, and **field initialisers run before a constructor's parameter
properties are assigned**, so it would have read undefined. It is now built in the constructor body,
with a note saying why. The equivalent in `BarDragHandle` happens to be safe only because it reads
its options lazily from inside a closure.

Two tests were reaching into `ModifierBar`'s privates for state that has now moved. Both were
retargeted at the class that owns it, including the key list drift guard, which is the one that stops
a modifier latching in the UI while Foundry never hears about it.
