# 7. Pinch must build on the canvas's actual scale

Date: 2026-08-09

Status: Accepted

## Context

[ADR 0006](0006-real-touch-input-drives-the-gesture-machine.md) closed the single finger touch gap
and named multi touch as what remained. Extending the harness to two fingers found a real,
user visible bug on the first measurement.

`CanvasController` kept its own `currentScale`, initialised to `1`, and multiplied each pinch ratio
onto it before calling `canvas.pan({ scale })`, which is an **absolute** setter. It also carried a
`syncScale` method to correct that value from the outside.

**`syncScale` was never called from anywhere.** A grep across `src/` returned only its own
declaration. Its existence is what made the caching look deliberate rather than broken.

Foundry fits a scene to the viewport when it loads, so the canvas almost never starts at `1`. The
consequence was that the first pinch of every session ignored where the canvas actually was.

## Measurement

Taken against a real Foundry 14.365 with the multi touch harness, on a 4000x4000 scene.

|                      | Before the fix               | After                                               |
| -------------------- | ---------------------------- | --------------------------------------------------- |
| Canvas scale on load | 0.5                          | 0.5                                                 |
| Finger separation    | 200px to 320px, a 1.6x pinch | same                                                |
| Expected scale       | 0.8                          | 0.8                                                 |
| **Actual scale**     | **1.6**                      | **0.8**                                             |
| Applied ratio        | 3.2x                         | 1.600x against a finger ratio of 1.600x, error 0.0% |

The error is exactly `1 / initialScale`, so it is worst on the scenes that are zoomed furthest out,
which are the large ones a tablet user is most likely to be pinching in the first place.

It also applied every time anything else changed the zoom: Foundry's own zoom controls, the mouse
wheel, or a scene change would all leave the remembered value stale, and the next pinch would lurch
back to wherever the module last thought it was.

**No test could have caught this.** `CanvasController` had no dedicated test file, and the tests it
did have in `gestureLayer.test.ts` used a fake whose `pan` recorded the call without applying it. A
fake that cannot change its own scale cannot express a bug about reading the wrong scale.

## Decision

Read the live scale from the canvas on every zoom, and make supplying it **required**.

`CanvasControllerOptions.getScale: () => number | null` is not optional. An optional callback could
be forgotten at a call site and would silently reintroduce exactly this bug, which is how the first
version survived. Making it required means every caller has to answer the question. `syncScale` is
removed, since nothing can go stale once nothing is cached.

The composition root supplies it, reading `canvas.stage.scale.x`, which keeps the knowledge of
Foundry's shape in the one file that is already documented as owning it.

A `lastAppliedScale` remains as a fallback for when the live read returns null, and is named to say
what it is rather than to imply it is authoritative.

## Consequences

**Pinch is now relative on any starting zoom**, and follows zooms made outside the module.

**Three regression tests**, using a fake that applies scale changes to itself. That change to the
fake is the load bearing part: the previous fake could not have failed. One test reproduces the
measured case directly, 0.5 with a 1.6x pinch expecting 0.8; one changes the scale from outside
between two pinches; one covers the null fallback.

**A live guard**, `npm run check:multitouch`, which asserts the ratio between before and after rather
than an absolute scale. An absolute assertion would have passed while the canvas jumped, because the
number it jumped to was itself perfectly predictable.

**The scene the guard creates is deliberately larger than the viewport**, so Foundry has to fit it
and the canvas does not start at 1. A scene that happened to load at 1x would hide the very bug the
file exists to guard against.

## What this says about the method

Every automated test in the repo passed, before and after. The bug was found within minutes of
pointing real input at a real canvas, and it was found by the harness's first two finger gesture. The
gap was never in the coverage numbers; it was that nothing had ever asked the canvas what scale it
was at.
