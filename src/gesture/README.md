# src/gesture

Turning real fingers into one virtual pointer. This is the half of the module that decides _what the
user meant_; `src/pointer` is the half that acts on it.

| File                         | What it is                                          |
| ---------------------------- | --------------------------------------------------- |
| `TouchBinder.ts`             | Real touch events in, gesture input out             |
| `ActionableTouches.ts`       | Which fingers on the screen are ours to act on      |
| `ExclusionZones.ts`          | Places the gesture layer must keep its hands off    |
| `TouchListenerSpecs.ts`      | The listener table: type, phase, passive, per bug   |
| `GestureStateMachine.ts`     | The pure state machine, no clock and no DOM         |
| `SingleFingerStates.ts`      | Idle, long-press-pending, tracking, dragging        |
| `SettledStates.ts`           | The states reached once a gesture has committed     |
| `TwoFingerTracker.ts`        | Pan versus pinch, and the arithmetic for both       |
| `TouchGeometry.ts`           | Centroids and distances                             |
| `TapWindow.ts`               | What counts as a tap, and as a double tap           |
| `GestureController.ts`       | Wiring the machine to the world                     |
| `CanvasController.ts`        | Panning and zooming the Foundry canvas              |
| `PointerTranslation.ts`      | Finger movement to pointer movement                 |
| `NativePointerSuppressor.ts` | Keeping real touch away from PIXI                   |
| `BuildSuppressor.ts`         | Assembling that suppressor from the exclusion rules |
| `SuppressedEvents.ts`        | Which events get suppressed, as data                |
| `SingleFingerPort.ts`        | What the single-finger states may call back into    |
| `GestureTypes.ts`            | The shared vocabulary                               |

## The machine is pure

`GestureStateMachine` never reads a clock, never sets a timer, never touches the DOM. Time arrives as
a `timer` input and the caller owns the scheduling. That is what makes the whole gesture vocabulary
testable without a browser, and it is worth protecting.

## Three rules that are load-bearing

**`passive: false`, and the phase matters.** See `TouchListenerSpecs.ts`: every entry encodes a bug
that took a physical device to find, and each is one option flag away from silently not working. A
bubble-phase listener still fires and a passive one still runs, and both look completely normal in a
debugger while what they exist to prevent goes right past.

**`preventDefault` is not `stopPropagation`.** Without the first, the browser scrolls, fires its own
synthetic mouse events about 300ms later, and shows selection handles. Without the second, PIXI turns
the raw touch into a second pointer. Both are needed and they do different jobs.

**Exclusion and ownership are two different questions.** `isExcluded` says "not ours to touch" (chat,
inputs, scroll regions). `isOwnInterface` says "this is our own furniture". They are not opposites:
the gesture layer must keep off our bar, while the native-pointer suppressor must do the _opposite_
and stop real events over it, because PIXI listens at the window and maps by coordinate rather than
by DOM target. `needsNativePointerEvents` is the narrow hole in that, for the bar's drag handle.

## The bug worth knowing about

`TouchEvent.touches` holds every finger on the **screen**, not the fingers on the event's target. A
finger landing in the sidebar is correctly ignored by `TouchBinder`, and then arrives anyway in the
canvas's own `touchmove`, where `input.touches.length >= 2` counts it. One finger dragging a token
became a pan because the other hand was holding the tablet.

`ActionableTouches` filters at that single boundary, rather than at the four `>= 2` checks spread
across three files. A touch whose `target` cannot be read is **kept**, because dropping what cannot be
attributed would silently disable pan and zoom on any engine that omits it.
