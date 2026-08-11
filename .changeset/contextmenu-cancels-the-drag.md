---
'tongs-browser': minor
---

**The browser's own `contextmenu` was cancelling every drag.** Found by reading Foundry's source
rather than guessing again.

`client/canvas/interaction/mouse-handler.mjs`, where `MouseInteractionManager` builds its handler map:

```js
contextmenu: this.#handleDragCancel.bind(this)
```

A `contextmenu` aborts an in progress drag outright, and `_onDragLeftCancel` writes nothing. So the
token stays exactly where it was while every other measurement looks healthy: the gate opens, the
state reaches `DRAG`, a preview clone is created, and the whole thing is thrown away. A device
reported precisely that, three cancels and not one drop, which is what pointed at the source.

On a phone a long press produces a native `contextmenu`, and a finger dwelling mid drag is not an edge
case, it is how people drag. A mouse only ever produces one on a deliberate right click, which is why
no desktop run in this entire investigation saw it, including under emulated touch.

`isTrusted` separates the two exactly: the browser's event is trusted, and the one this module
synthesises for its own long press gesture is not. So a stray long press is swallowed and the
deliberate right click still reaches Foundry. Excluded regions keep their menus, so a long press in
chat still offers copy.

⚠️ jsdom defines `isTrusted` as a non configurable own property, so nothing dispatched inside it can
ever be trusted and the central claim here is undispatchable there. The guard's decision is therefore
tested by handing it the event shape directly, and the binding by dispatching. Pretending a jsdom
event were trusted would have been testing the fake rather than the code.
