---
'tongs-browser': minor
---

**A `pointercancel` from the real finger was killing every drag.** Suppressed now, like the other three.

The native touch suppressor stopped `pointerdown`, `pointermove` and `pointerup` from reaching
Foundry twice over, and never touched `pointercancel`. A mouse never fires one, which is exactly why
desktop has never seen this in any configuration: not at 1600x1000, not under emulated touch, a
mobile user agent and dpr 3, not with 1.6px micro steps matching a finger's cadence, not while the
canvas pans underneath. All of those pass.

A touchscreen fires `pointercancel` whenever the browser takes a gesture over: a scroll, an edge
swipe, a second finger, a system gesture. Foundry's MouseInteractionManager treats a cancel as an
ABORT. It resets the interaction and discards `interactionData`, including the `screenOrigin` its
10px drag gate is measured from. So one stray cancel mid grab ends the drag silently. The state sits
at `GRABBED` forever, no preview appears, and the token does not move however far you drag.

The measurement that finally isolated it: **Foundry's drag origin was readable for 2 of 55 moves on
the device, against every step of the same gesture on desktop.** Two samples is an interaction being
destroyed almost immediately and never coming back, and the sample counts added a release earlier are
the only reason that was visible at all.

Our own `pointercancel` still passes through, because `VirtualPointer.cancelDrag` sends one to
release a held button when a gesture is abandoned, and swallowing that would leave a token stuck to
the pointer.

Also corrected: the `PIXI moves: layer=N stage=N` counter carried a comment claiming it "separates the
two remaining possibilities". It does not. A **working** desktop drag measures `layer=5 stage=39`,
the same one in ten ratio as the device's `layer=8 stage=112`, so that number cannot tell a working
drag from a broken one and never could.
