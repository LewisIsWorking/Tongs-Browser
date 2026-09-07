---
'tongs-browser': minor
---

Start disabled on a desktop, where a finger driven pointer is not wanted.

`Enabled` defaulted to true everywhere, so opening Foundry on a PC got a virtual cursor, a modifier
bar and the whole interface shrunk to 75%. The module had no device detection of any kind: the only
`navigator.userAgent` in it is a line of diagnostics text that nothing has ever read to decide
anything.

It now asks `(pointer: coarse)`, which is the primary input's precision, rather than sniffing a user
agent string that lies by design and rots as browsers change it. A phone answers yes and starts
enabled. A desktop answers no and starts disabled. A touchscreen laptop also answers no, which is
right: the mouse is there, and a virtual cursor driven by a real cursor is absurd.

It is a default and never a lock. The setting and the scene control toggle are unchanged, a stored
value always wins, and the choice is logged either way, because "the module did nothing" and "the
module failed to load" look identical from outside.
