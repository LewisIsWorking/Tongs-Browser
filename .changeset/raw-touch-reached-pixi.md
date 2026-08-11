---
'tongs-browser': minor
---

**The finger was driving PIXI in parallel with the virtual pointer.** That is what broke dragging.

The touch handlers called `preventDefault()` and stopped there. That prevents scrolling and the
browser's compatibility mouse events, and it does **nothing** about propagation. PIXI listens for
`touchstart`, `touchmove` and `touchend` itself and normalises them into its own pointer events, so
every real touch reached Foundry regardless of the pointer event suppression sitting next to it.

Foundry therefore saw two interactions at once: ours, holding a button on the token, and the
finger's, beginning wherever the finger actually was. The finger is never on the token, because
putting the pointer somewhere the finger is not is the entire purpose of this module. The finger's
stream destroyed the token's `interactionData`, so the drag gate had nothing to measure from, the
state never left `GRABBED`, no preview was created and the token never moved.

The touch listeners now bind in the **capture** phase and stop propagation there, so the raw stream
never reaches the canvas. The gesture layer still receives every touch first, excluded regions such
as chat keep their own scrolling and handling, and the whole thing stays behind the existing
suppression setting for coexisting with TouchVTT.

## How it was finally caught

By driving the module's own pointer against the phone over wireless adb, with no finger involved:

    Adopted 'Anthony' at (2900, 2200)
    token position : (2900, 2200) -> (3000, 2200)
    peak state     : 4 (DRAG),  drag clones: 1
    screenOrigin   : 180, pinned across all 12 steps
    PASS

Same device, same build, same gesture. **12 origin samples of 12 without a finger, against 2 of 235
with one.** Everything except the finger had already been eliminated by measurement, and the only way
to see that was to run the same assertions on the hardware rather than reason about it.
