# scripts/android

Driving the module on a **real tablet** over adb, rather than in a desktop browser pretending to be
one. Run by `npm run check:android`.

| File               | What it is                                            |
| ------------------ | ----------------------------------------------------- |
| `CheckTap.ts`      | Tap, on glass                                         |
| `CheckHover.ts`    | Hover, and what it highlights                         |
| `CheckKeyboard.ts` | Whether synthesised keys are honoured on this device  |
| `CanvasChecks.ts`  | The board responds                                    |
| `HoverDriver.ts`   | Moving the pointer around for the hover checks        |
| `ProbeTokens.ts`   | Finding or adopting a token to work with              |
| `Geometry.ts`      | Device coordinates, which are not desktop coordinates |
| `BarSetting.ts`    | Putting the bar where the check needs it              |
| `PageObservers.ts` | Watching what the page does                           |
| `CheckResults.ts`  | Collecting the answers                                |

## This is a different surface, not a smaller one

The device path attaches to a tab that is **already open** through a hand written CDP client
(`scripts/cdp-page.ts`), which implements `evaluate` and nothing else. It has no `addInitScript`, and
adding one would not help, because nothing navigates: a script registered to run on new documents
never fires. That constraint is why `scripts/drag/DragToken.ts` cannot take the split that
`scripts/probe` took. See `scripts/drag/README.md`.

There is also no viewport to set and no `hasTouch` to opt into. The viewport is whatever the screen
gives us, which is the entire point of running here.

## Two addresses

The device cannot reach `localhost`. `FOUNDRY_URL` is what the **browser** must use (your machine's
LAN address); `FOUNDRY_HOST_URL` is what this Node process uses. Conflating them makes the harness
fetch an address it cannot reach and report "nothing is answering", which reads as Foundry being
down when Foundry is perfectly healthy.

## Adopt the user's token, do not create one

`ProbeTokens.ts` prefers whatever is already controlled. Creating a `[probe]` token on a device
during a real session writes to the world someone may be playing in, and the user's own token is the
better subject anyway: it is the one the bug was reported against.

## Getting the console

`chrome://inspect` in desktop Chrome, with the tablet connected by USB and USB debugging on. It gives
a full devtools session against the tablet's Foundry tab, which is by far the most useful debugging
tool for this module, because most failures here are silent.
