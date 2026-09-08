---
'tongs-browser': patch
---

Fix a stack overflow when the module shows a notice.

`ui.notifications.info` is a method: Foundry implements it as
`info(message, options) { return this.notify(message, "info", options) }`. It was handed out
detached, and called straight off the object literal it was returned in, so `this` became that
literal. The literal has a `notify` property holding the same function, so `info` called itself until
the stack ran out.

Losing `this` normally throws at once and obviously. Here the accidental receiver carried a property
of exactly the right name, so an ordinary mistake became infinite recursion whose stack is entirely
Foundry's own minified source, with no frame of this module in it.

Found on the first world that ever had party actors in it, which is the first to reach that line.
