# 6. Real touch input drives the gesture machine, measured on 14.365

Date: 2026-08-09

Status: Accepted

## Context

[ADR 0005](0005-both-interaction-surfaces-accept-the-virtual-pointer.md) measured that Foundry accepts
the virtual pointer, and was explicit about what it did not cover:

> Touch input. The check drives `VirtualPointer` directly through the module API, bypassing
> `TouchBinder` and the gesture state machine. Those are covered by unit tests, and by nothing that
> has ever seen a real finger.

That gap was the largest remaining one, and it turns out not to need a tablet. Chrome DevTools
Protocol can inject touch through the browser's own input pipeline, which is a materially different
thing from constructing a `TouchEvent` in script:

- the events arrive with `isTrusted` true
- **the browser emits its own compatibility pointer and mouse events alongside them**, exactly as a
  tablet does

The second point is the one that matters most. Suppressing those compatibility events is a real
feature with a real failure mode, every gesture being acted on twice, and no hand built event can
exercise it because no hand built event causes the browser to emit the pair.

## Measurement

`npm run check:touch`, 2026-08-09, Foundry 14.365, headless Chrome with a touch enabled context.
Defaults in force: trackpad mode, sensitivity 1.5, long press 500ms. All five checks passed.

| Check                                           | Result                                                                         |
| ----------------------------------------------- | ------------------------------------------------------------------------------ |
| Context reports touch support                   | `ontouchstart in window = true`                                                |
| One finger drag moves the pointer               | 200x120 drag moved it (300, 180), an x ratio of **1.00** of the expected 1.5x  |
| **Tap clicks at the pointer, not the finger**   | pointer parked (1578, 134), finger tapped (400, 750), sidebar `chat -> combat` |
| Long press right clicks at the pointer          | 1 contextmenu at (1577, 134), pointer at (1578, 134)                           |
| Native touch pointer events never reach Foundry | none leaked past the capture phase                                             |

**The tap check is the important one.** `MANUAL-TESTING.md` states the claim as "tap clicks at the
pointer, not where your finger landed; if it clicks under your finger, something is wrong". So the
pointer is parked on a sidebar tab and the finger taps far away over the canvas. The tab changing is
only possible if the click went to the pointer. Judged by `ui.sidebar.tabGroups`, Foundry's own
record, rather than by a CSS class.

The drag assertion is a **ratio inside a band**, not an equality. The pointer clamps at the viewport
edge and the gesture machine has a movement threshold before it engages, so an exact figure would
fail for reasons that are not bugs. It happened to land on 1.00.

The long press is judged by listening for `contextmenu`, not by looking for a Foundry menu, and that
limit is deliberate: an empty canvas has no token to open a HUD for, so a menu appearing is not
available as evidence. What it does prove is that the long press timer fires under real event
timing, which a unit test with an injected clock cannot show.

## Consequences

**`TouchBinder` and the gesture state machine are exercised end to end** by trusted input, against a
real Foundry, with a real canvas. The chain now measured in full is finger, to `TouchBinder`, to
`GestureController`, to `VirtualPointer`, to Foundry acting on it.

**Native touch suppression is confirmed working** against the events it was written for, rather than
against a reconstruction of them.

**Still not covered**, and still device work:

- Multi touch. Only one finger is used here. Two finger pan, pinch zoom and the exclusion zones are
  untested against real input.
- Hover semantics. A tracking pointer is not proof that nameplates, tooltips or PF2e HUD panels
  appear.
- Android itself: real hardware, real Chrome for Android, real screen size, and the module stack
  (PF2e, PF2e HUD, Workbench, Health Estimate) that the checklist assumes.
- Ergonomics, which is the actual reason the module exists and which no automated check can judge.
