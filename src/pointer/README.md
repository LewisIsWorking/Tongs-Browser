# src/pointer

The virtual pointer itself. `src/gesture` decides what the user meant; this folder makes Foundry
believe a mouse did it.

| File                     | What it is                                                      |
| ------------------------ | --------------------------------------------------------------- |
| `VirtualPointer.ts`      | The public object: move, click, drag, wheel                     |
| `PointerState.ts`        | Where it is, what buttons are down, is it dragging              |
| `EventDispatcher.ts`     | Putting synthesised events onto the right target                |
| `EventDescriptor.ts`     | One event described as data, before it becomes an object        |
| `descriptorFactory.ts`   | Building those descriptors consistently                         |
| `clickSequence.ts`       | The events a real click is made of, in order                    |
| `dragSequence.ts`        | Press, moves, release                                           |
| `moveSequence.ts`        | A bare move, with the hover it implies                          |
| `wheelSequence.ts`       | Zoom                                                            |
| `HoverSequence.ts`       | Entering and leaving what is under the pointer                  |
| `HitTester.ts`           | What is under the pointer right now                             |
| `CoordinateTransform.ts` | Client, canvas, and stage coordinates                           |
| `DragController.ts`      | Holding a drag across many moves                                |
| `DragCapture.ts`         | Keeping the drag attached while things move underneath          |
| `CursorOverlay.ts`       | The thing you can actually see                                  |
| `ModifierFlags.ts`       | Shift, ctrl, alt, meta on every synthesised event               |
| `buttons.ts`             | The `button` and `buttons` fields, which are not the same field |

## A sequence, not an event

Foundry does not respond to a `click`. It responds to `pointerdown`, `mousedown`, `pointerup`,
`mouseup`, `click`, in that order, with `button` and `buttons` set consistently across all five and
`detail` counting up for a double click. Dispatch one of them and nothing happens, silently.

That is why the sequences are separate files and are described as **data** first
(`EventDescriptor.ts`) and turned into objects second. A sequence you can print is a sequence you can
diff against what a real mouse produced, which is how several of these were fixed.

## `button` and `buttons` are different fields

`button` is which button caused _this_ event; `buttons` is a bitmask of what is held _now_. A
`pointerup` has `button: 0` and `buttons: 0`, while the `pointerdown` before it has `button: 0` and
`buttons: 1`. Getting this wrong produces events that look right in a debugger and that Foundry
quietly ignores. See `buttons.ts`, which exists solely to stop that being retyped per sequence.

## Hover is part of moving

Foundry highlights a token on `pointerover` and clears it on `pointerout`, so a pointer that only
moves leaves the previous token lit and the new one dark. `HoverSequence.ts` emits the enter and
leave pair whenever the element under the pointer changes.

## The pointer is clamped to the viewport

`HitTester` clamps, which matters more than it sounds: a drag longer than the viewport would press in
the middle, run into the edge, and stop, leaving the pointer where the clamp put it rather than where
it was sent. A check that then compares distance travelled against distance requested reports "the
drag is not following the pointer" about its own arithmetic.
