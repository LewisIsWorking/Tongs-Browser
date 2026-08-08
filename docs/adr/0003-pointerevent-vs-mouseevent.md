# 3. Synthesise both PointerEvent and MouseEvent

Date: 2026-08-08

Status: Accepted

## Context

Foundry has two interaction surfaces that behave differently.

The canvas is WebGL, rendered by PixiJS. Nothing on it is a DOM element, so PIXI runs its own hit
testing over a single canvas element and dispatches its own internal events from whatever DOM events
it receives on that element.

The HTML chrome is ordinary DOM. Sidebars, sheets, dialogs and hotbars are elements with ordinary
listeners, and modules bind to them directly.

A virtual pointer has to satisfy both. Getting this wrong produces a specific and confusing failure:
the interface works and the board does not, or the reverse, with no error in the console either way.

## The version question, and a correction

The original design brief stated:

> Modern Foundry canvas interaction runs on PIXI v8, which listens for PointerEvents, not legacy
> MouseEvents. Dispatching only MouseEvent will appear to work on the HTML sidebar and fail silently
> on the canvas.

The conclusion is right. The premise is out of date.

Foundry 14 does not run PIXI v8. The tracking issue
[foundryvtt/foundryvtt#11183, "Adopt PIXI v8 as a comprehensive overhaul to the way that canvas
rendering occurs"](https://github.com/foundryvtt/foundryvtt/issues/11183) was still open at the time
of writing, labelled `epic`, with no milestone and no linked branches or pull requests. The migration
was explored for Version 13 and deliberately deferred, on the grounds that the disruption to module
developers was not justified at that point.

So the correct statement is that Foundry 14 runs **PIXI v7**.

This does not change what the module should do, because PIXI v7 already prefers pointer events. Its
federated event system attaches pointer listeners when the browser supports them and falls back to
mouse listeners only when it does not. Every browser this module targets supports them, so the
canvas is driven by pointer events on both PIXI generations.

The conclusion therefore survives the corrected premise, and would survive a future upgrade to PIXI
v8 as well.

## Decision

Synthesise **both** families for every interaction.

- `PointerEvent` for `pointerover`, `pointerenter`, `pointerdown`, `pointermove`, `pointerup`,
  `pointerout`, `pointerleave` and `pointercancel`.
- The legacy `MouseEvent` equivalents alongside, plus `click`, `dblclick` and `contextmenu`.
- `WheelEvent` for scrolling and zoom.

Pointer events are dispatched before their mouse counterparts at each phase, matching the order a
real browser produces.

Sending only one family is the failure mode this decision exists to prevent. Pointer only would work
on the canvas and miss the substantial amount of Foundry chrome and third party module code that
still binds `mousedown` and `click`. Mouse only would work on the chrome and, on a PIXI v8 future,
fail on the canvas.

## Verified rather than assumed

Two things in this area were checked empirically instead of reasoned about, because both were
load bearing and both turned out to be worth checking.

### Hit testing is transform aware

The brief predicted that `transform: scale()` on the interface would break `elementFromPoint`, and
that the pointer would need to convert coordinates into scaled space before every hit test, calling
it "the single most likely source of the cursor is visually here but clicks land there bugs".

Tested against Chromium: a 400px box scaled to `0.5` about its top left, containing a child at
200,200.

| Probe                                                                   | Result                                                           |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `elementFromPoint(120, 120)`, the child's visual position               | the child                                                        |
| `elementFromPoint(250, 250)`, the child's untransformed layout position | nothing                                                          |
| `child.getBoundingClientRect()`                                         | `left 100, top 100, width 50, height 50`, already post transform |
| Real mouse click at the visual position                                 | hits the child                                                   |
| Synthetic `PointerEvent` at viewport coordinates                        | hits the child, `clientX` 120                                    |

Browser hit testing accounts for CSS transforms. `elementFromPoint` takes viewport coordinates, so a
cursor drawn at a point and a hit test at that point already agree at any scale.

The practical consequence is the opposite of the prediction: converting into scaled space would take
coordinates that are already correct and break them. The module therefore hit tests at raw viewport
coordinates while the interface is scaled, and there is a test pinning that so the UI scale cannot
later be wired into the hit tester.

`CoordinateTransform` is kept rather than deleted, because the phase 2 Android shell uses
`WebSettings.setInitialScale`, which genuinely does decouple device coordinates from CSS pixels in a
way that no CSS transform does. See ADR 0002.

### pageX and pageY cannot be set

The brief asked for `pageX` and `pageY` on every synthesised event. They are not settable: no event
constructor's init dictionary accepts them, and the browser derives them from `clientX` plus scroll
offset. Setting `clientX` and `clientY` correctly is what makes them come out right, and that is what
the dispatcher does.

## Consequences

Every interaction dispatches roughly twice as many events as a real mouse would. That is acceptable:
the volume is small, and listeners for both families on the same element are rare enough in practice
that double handling has not been observed. If it becomes a problem, the mouse family can be made
conditional on the pointer event going unhandled, at the cost of a good deal more complexity.

The `isTrusted` question is a separate matter and is not settled here. It applies to keyboard events
rather than pointer events, and is handled by a runtime probe. See `KeyboardSynthesizer`.

## Revisiting

Re-run the checks above on any Foundry major version bump, particularly if
[#11183](https://github.com/foundryvtt/foundryvtt/issues/11183) closes. The decision is expected to
hold either way, but the reasoning behind it changes, and a future reader should not have to
rediscover which PIXI generation was in play.
