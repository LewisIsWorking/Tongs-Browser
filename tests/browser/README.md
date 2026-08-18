# tests/browser

The tests jsdom cannot run, against real Chromium. Driven by Playwright (`npm run test:browser`).

| File                | What it is                                            |
| ------------------- | ----------------------------------------------------- |
| `pointer.spec.ts`   | Hit testing and pointer behaviour against real layout |
| `interface.spec.ts` | The bar and its controls, with real boxes             |
| `foundry-stub.html` | A minimal page standing in for Foundry's canvas       |

## Why these cannot live in `tests/dom`

jsdom has no layout engine. `offsetWidth` is always 0, `elementFromPoint` is a fiction, and nothing
is ever genuinely on top of anything else. Every assertion here depends on a real box:

- whether the pointer overlay is hit testable, which decides if it swallows the taps meant for the
  board underneath it
- whether the scene control is covered by the modifier bar
- where a click actually lands once the interface has been scaled

Those are exactly the failures that look fine in a unit test and are obvious on a screen.

## They run against `dist/`

Build first. Testing the built bundle rather than the sources is deliberate: it is the artefact
Foundry loads, and a green suite against sources that never checked the bundle is how an uninstallable
release ships.

## A stub, not a Foundry

`foundry-stub.html` provides the canvas and the globals the module touches, and nothing else. Running
these against a real Foundry would make them slow, order dependent, and unable to run in CI. The real
thing is covered by the live harnesses in `scripts/`, which is a separate promise: these prove the
module's own behaviour, those prove it still fits Foundry.
