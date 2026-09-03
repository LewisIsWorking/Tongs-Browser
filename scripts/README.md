# scripts

Guards that run in CI, and harnesses that drive a real Foundry.

## Guards, run by `npm run verify`

| File                          | What it enforces                                           |
| ----------------------------- | ---------------------------------------------------------- |
| `check-file-sizes.ts`         | The 200 line limit, with a ratchet that tightens both ways |
| `check-folder-readmes.ts`     | Every source folder documented, and boilerplate rejected   |
| `check-em-dashes.ts`          | No em dashes                                               |
| `check-orphaned-docblocks.ts` | No docblock left above nothing                             |
| `check-scripts-load.ts`       | Every script can still be loaded by Node                   |
| `check-support-adopted.ts`    | No shared fixture that nothing imports                     |
| `check-dead-exports.ts`       | No export that nothing imports                             |
| `check-document-access.ts`    | Foundry documents enumerated through one filtered boundary |
| `check-mutations.ts`          | The tests still catch the bugs they were written for       |
| `prune-unused-imports.ts`     | Tidying, on request                                        |
| `stamp-manifest.ts`           | The real version into the released `module.json`           |

## Harnesses, run by hand against a live world

| File                           | What it drives                                        |
| ------------------------------ | ----------------------------------------------------- |
| `foundry-live-check.ts`        | Is anything obviously wrong (`check:foundry`)         |
| `foundry-touch-check.ts`       | Tap, drag, long press (`check:touch`)                 |
| `foundry-multitouch-check.ts`  | Pan and pinch (`check:multitouch`)                    |
| `foundry-grab-button-check.ts` | Grab, hold, drag (`check:grab`)                       |
| `foundry-drag-check.ts`        | The drag, in detail (`check:drag`)                    |
| `foundry-play-probe.ts`        | Can you actually play the game (`probe:play`)         |
| `foundry-probe.ts`             | The keyboard strategy answer (`probe:foundry`)        |
| `foundry-android-check.ts`     | All of it, on a real tablet (`check:android`)         |
| `foundry-session.ts`           | Getting a browser into a world; shared by all of them |
| `cdp-page.ts`                  | A minimal CDP client, for the phone                   |
| `await-device-then.ts`         | Waiting for a device to appear                        |

Subfolders carry their own READMEs: `foundry/`, `probe/`, `drag/`, `touch/`, `live/`, `android/`,
`sizes/`, `readmes/`.

## ⚠️ Flags go through `node`, not `npm run ... --`

npm 12 parses unknown flags **itself**, even after the `--` separator, and exits before the script
runs:

```
npm error Invalid abbreviated flag "--update". Did you mean "--update-notifier"?
```

So use the direct form:

```
node scripts/check-file-sizes.ts --update
node scripts/foundry-drag-check.ts --hold=700
```

This caught out the size guard, which printed the `npm run` form as its own remedy.

## Running a harness

Needs a launched world and `FOUNDRY_PASSWORD`. `PLAYWRIGHT_CHANNEL=chrome` uses installed Chrome
instead of a downloaded Chromium.

⚠️ They **write to a live world**: `[probe]` scenes, actors and tokens, cleaned up as they go. Point
them at a world you are willing to have written to.

## A guard is only real if it runs

`check:sizes` shipped a `--self-test` that appeared in no npm script and no workflow, so it had never
once executed. Every guard with a self test now runs it as part of the check itself. A proof nobody
invokes cannot fail, which is the same as not having one.

That rule is no longer a convention to remember: `tests/unit/guardSelfTests.test.ts` enumerates the
guards and asserts each one's npm script runs both its `--self-test` and the real check. A new guard
is adopted by it automatically, which is how `check:mutations` was checked on the day it was added.

⚠️ This paragraph used to say "both guards", which was true when written and stopped being true
without anything failing. Prose counts go stale silently; that is what the enumerating test is for.

## Coverage says a line ran, not that a wrong version would be noticed

`check-mutations.ts` is the newest guard and the one that answers a question the others cannot. The
coverage ratchet in `vitest.config.ts` asks whether a line **executed**. It cannot ask whether the
tests would have **objected** to a different line.

The gap is not theoretical. On 2026-09-03, replacing a lookup in `PartyAccessFlow` with
`readParties()[0]` passed all eleven of that flow's tests, at 100% coverage of the line, and passed
the first test written specifically to close it. See `mutations/README.md` for how to record one and
for the two traps the runner is built around.
