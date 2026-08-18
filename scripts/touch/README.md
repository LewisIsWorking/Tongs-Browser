# scripts/touch

The touch half of the live checks: real fingers on a real canvas, driven through Playwright's touch
emulation rather than through the module's API.

| File                   | What it is                                 |
| ---------------------- | ------------------------------------------ |
| `tapChecks.ts`         | Tap, and where the click lands             |
| `pinchChecks.ts`       | Two finger pan and pinch                   |
| `grabDragCheck.ts`     | Grab button, hold, then drag               |
| `suppressionChecks.ts` | Native touch events must not reach Foundry |
| `support.ts`           | Shared setup for the above                 |

Run by `npm run check:touch`, `check:multitouch` and `check:grab`.

## These test the gesture layer, the drag check does not

`scripts/drag` drives the module's **public pointer API** on purpose, so a failure there cannot be
blamed on gesture interpretation. These drive **real touch**, so they cover the half that one
deliberately excludes. Between them, a failure has a much smaller place to hide.

## The assertion that catches the subtle bug

`suppressionChecks.ts` asserts that nothing leaks: a finger on our own tray must produce **no**
trusted pointer events at the window. That is not tidiness. PIXI listens at the window in the capture
phase and maps events onto the canvas **by coordinate rather than by DOM target**, and our bar sits
over the canvas, so a leaked `pointerup` reaches `#handlePointerUp`, which ends in
`#handleDragCancel` and throws away a held token drag.

Measured 2026-08-12: one finger tap on the grab button put seven trusted events on the window,
including a `pointerup` with `pointerType: 'touch'`, all at the button's own coordinates.

## Pinch is measured relative, never absolute

`pinchChecks.ts` asserts the applied ratio against the finger ratio, not against a fixed zoom level.
The scene does not start at 1x, so an absolute assertion passes or fails on where the canvas happened
to be rather than on what the pinch did. The check asserts the scene is **not** at 1x first, so that
a relative measurement is meaningful at all.
