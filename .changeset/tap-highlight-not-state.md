---
'tongs-browser': patch
---

Stop the browser's tap highlight masquerading as a button state.

Reported from a device: the pause button appeared lit while the game was **not** paused. The orange
was Vivaldi's own tap highlight sitting on the last button touched, and it looked exactly like the
latched state the grab button shows when it really is on.

A control that reports a state it does not have is worse than one that reports nothing, because it
invites the tap that undoes what you wanted. The native highlight is now suppressed on every button
in the bar and the tab picker, and focus gets a blue outline that cannot be mistaken for the gold
latched styling, which changes border weight as well as colour.
