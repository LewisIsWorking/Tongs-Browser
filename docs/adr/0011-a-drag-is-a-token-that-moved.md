# 0011. A drag is a token that moved, not a stream of events

Date: 2026-08-11

Status: accepted

## Context

Three device reports in a row said "still can't drag". Three rounds of fixes shipped against them.
The test suite was green for all three, and grew by a dozen tests along the way.

Every one of those tests asserted on the **event stream**: that `pointermove` still carried
`buttons=1`, that the element captured at `pointerdown` was reused instead of re-hit-tested, that the
sequence builder emitted the descriptors it was asked for. Those are all real properties, two of them
were genuinely broken and genuinely fixed, and none of them is what a drag is.

A drag is a token ending up somewhere else. Everything between the finger and that fact is
implementation, and a test that asserts on implementation cannot fail when the implementation is
wrong in a way nobody thought of. That is not a slip anyone made once; it is the only kind of
assertion jsdom can support. There is no PIXI in the unit suite, no hit testing, no Foundry and no
token, so the event stream is quite literally the only observable available. The suite asserted what
it could see rather than what it meant, and that gap is where three releases went.

Driving the module's own `getPointer()` against a live Foundry closes it. `token.document.x` is
observable there, and it is the thing being claimed.

## Decision

`npm run check:drag` selects a token, drives the virtual pointer through grab, move and drop, and
passes only if the token document ends up somewhere else, **by roughly the distance dragged**.

Four properties of it are load bearing, and each one was a bug in the check before it was a feature:

**It asserts distance, not change.** The first passing run moved the token 17.64px for a 240px drag
and reported PASS. "It moved" is satisfied by a token that lurches a fraction of the way, which is a
bug a user would report as "dragging barely works". The tolerance is one grid square, which is what
snapping is allowed to take, and nothing else is forgiven.

**It waits for the position to settle, not to change.** That 17.64px was not the module at all.
Foundry 13 and later animate a token along its movement path, so the document passes through every
intermediate coordinate on the way. Sampling the first difference reads the token mid flight and
returns a number that is real, stable looking, and wrong.

**It pans to the token before pressing.** Without that it pressed at `(-375, -325)`, off screen, hit
nothing, and reported "the token did not move". Perfectly true, and it accuses the module of a bug in
code that never ran. A scene larger than the viewport opens centred on the scene, not on whatever the
check cares about. This is [ADR 0010](0010-a-check-must-say-whose-fault-it-is.md) again: a check that
can accuse the feature for its own reasons is worse than no check.

**It refuses to give a verdict it cannot support.** If the press point is not over `canvas#board`,
that is a hard error, not a failure. A bad press point makes the drag result unreadable rather than
bad, and the two must not come out of the same exit code.

**It traces three positions per step**: where our pointer is, where Foundry recorded the drag
destination, and where the drag clone sits. A failing drag is a disagreement between those three, and
which pair disagrees names the bug. Pointer against destination is the event mapping; destination
against clone is Foundry declining to follow; clone against the committed document is the drop.

## What it found

The drag was not broken. Measured against a live Foundry 14.365 on 2026-08-11:

|                            | start | end  | travelled         |
| -------------------------- | ----- | ---- | ----------------- |
| our pointer                | 820   | 1040 | 220               |
| Foundry's drag destination | 670   | 890  | 220               |
| the drag clone             | 600   | 800  | 200, grid snapped |
| the committed document     | 600   | 800  | 200               |

Every stage tracks the pointer, and the move commits. The pointer capture fix and the drag routing
fix in 0.17.0 and 0.18.0 both landed and both work.

What was broken was the **grab button**, which held the mouse button down until tapped again and
showed the same open hand either way. Foundry only commits a token move on the drop, so a held grab
leaves the token exactly where it started, which is indistinguishable from a broken drag from the
other side of the screen. The last device report was taken mid drag for precisely this reason.

The button now reads `DROP` while it is holding something. The latched gold styling was never going
to carry that on its own: colour says "on", and "on" does not tell you the next thing to do is tap it
off.

## Consequences

- `npm run check:drag` needs a live Foundry with a world launched, like the other live checks. It
  creates a probe actor, token and scene, all prefixed `[probe]`, and removes them in a `finally`.
- It is the first check that asserts on **document state** rather than on events or on canvas
  transforms. New behaviour with an observable outcome should follow it rather than the event style.
- The event-stream tests stay. They are precise about things that are genuinely true and they
  localise a failure quickly. They are simply not evidence that dragging works, and this ADR exists
  so that nobody reads them that way again.
- `TrayAction.getLabel` exists so a stateful button can say what it wants rather than only what it
  is. Use it for anything latching.
