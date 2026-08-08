---
'tongs-browser': minor
---

Add the sticky modifier key bar.

A floating, draggable, collapsible bar offering Ctrl, Shift, Alt, Space, Delete, Escape, Enter and
Tab. Modifiers latch on tap, lock on a second tap, and release on a third. Latched keys clear after
one action while locked ones stay held. Events are dispatched by `code`, which is what Foundry's
keybinding system matches on.

Includes a startup probe that measures whether this Foundry build honours synthesised keyboard
events, falling back to writing the keyboard manager's held key set directly, with a warning, when
it does not.
