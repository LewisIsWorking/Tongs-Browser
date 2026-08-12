---
'tongs-browser': patch
---

Extract the bar's utility buttons into `modifiers/ActionButtons.ts` at 100% coverage.
`ModifierBar.ts` drops from 514 to 427.

These sit **outside** the keys container on purpose, so they survive the bar being collapsed:
collapsing hides the modifier keys, which is the point of collapsing, but an action like "show the
sidebar" is most needed exactly when the bar has been shrunk out of the way.

What the new suite pins:

- **Grouped buttons share one container**, so related controls cluster rather than wrap apart. Four
  pan arrows split across a line break stop reading as a d-pad and become four unrelated arrows.
- **The label is refreshed as well as the latch.** A latched button whose label never changes cost a
  whole round of device diagnostics: the gold styling says "on", but "on" does not tell you the next
  thing to do is tap it OFF.
- **`aria-pressed` as well as the class**, because a latch that is only a colour is invisible to a
  screen reader and to anyone who cannot tell this gold from this grey.
- **A refresh runs immediately after an action**, so a button that reports state is never a tap
  behind the truth.

Two existing tests reached **two levels** into `ModifierBar`'s privates to delete an entry from its
action map. That map now belongs to `ActionButtons`, so those cases moved to a suite on the class
that owns it, where the missing button case is a legitimate thing to describe rather than a coverage
manoeuvre. `TrayAction` moves to its own file so `ActionButtons` can describe one without importing
the bar that imports it, and is re-exported so every existing importer keeps working.
