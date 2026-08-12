---
'tongs-browser': patch
---

**Suppress the browser's own touch pointer events where PIXI can actually be beaten to them.** This
is the cause of the drag failure, named from a device report for the first time.

The report showed roughly two hundred `_onDragLeftCancel` calls, every one triggered by an event
with `pointerType: 'touch'`, while the gesture layer was already "suppressing" exactly those. Reading
PIXI's own registration in Foundry 14.365, `@pixi/events/lib/EventSystem.mjs`:

```
globalThis.document.addEventListener('pointermove', this.onPointerMove, true)
this.domElement.addEventListener('pointerover',  this.onPointerOverOut, true)
globalThis.addEventListener('pointerup',   this.onPointerUp, true)
```

⚠️ **`pointerup` is registered on the WINDOW.** In the capture phase the window fires BEFORE the
document, so a document listener cannot stop it however carefully it is written. Foundry's
`#handlePointerUp` ends with `this.#handleDragCancel(event)`, so **any** pointerup that reaches the
manager cancels the drag, and `_onDragLeftCancel` writes nothing: the token returns to where it
started while every other measurement looks healthy.

Three things had to change together, and any one of them alone leaves it broken:

1. **Bind on the window**, not the document, because that is where PIXI is.
2. **Bind at `init`**, before Foundry builds the canvas. Two capture listeners on one node fire in
   REGISTRATION ORDER, so anything bound at `ready` is already behind PIXI.
3. **`stopImmediatePropagation`**, not `stopPropagation`. PIXI's listener is on the same node, and
   plain propagation does not stop those.

Also: **`pointerover` and `pointerout` were never suppressed at all.** Foundry's
`MouseInteractionManager` binds both, and the device report opens with
`manager.cancel at GRABBED [pointerover ... touch]`.

⚠️ Not yet confirmed on hardware. Every previous hypothesis in this investigation was disproven by a
device, and this one is read from Foundry's and PIXI's source plus one report rather than measured on
the phone.
