# tests/unit

The pure half: no DOM, no browser, no Foundry. Run by the `unit` vitest project.

Everything here tests a function or a state machine against made up inputs. If a test needs an
element, it belongs in `tests/dom` instead.

Representative files: `gestureStateMachine.test.ts`, `sequences.test.ts`, `clickSequences.test.ts`,
`joinUsers.test.ts`, `sizeRatchet.test.ts`, `folderReadmes.test.ts`, `serverAbsence.test.ts`.
Shared setup lives in `support/`.

## What this half is for

The gesture machine never reads a clock, never sets a timer and never touches the DOM, so the whole
gesture vocabulary can be exercised here: taps, double taps, long presses, two finger pans, pinches,
and every transition between them. Time arrives as an input rather than as a wait, which is why these
run in milliseconds and never flake.

The same is true of the event sequences: they are data, so what a click _is_ can be asserted without
dispatching anything.

## The guards are tested here too

`sizeRatchet.test.ts` and `folderReadmes.test.ts` test the rules the repository enforces on itself,
against made up files and folders rather than against today's tree. A guard proved only by the repo
passing stops proving anything the moment the repo is clean, and it cannot demonstrate that it would
have **caught** the thing it exists to catch.

## Assert the outcome, not the mechanism

A test that asserts which internal method ran passes when the behaviour is broken and fails when the
implementation is tidied. Several tests here were rewritten after exactly that: three green releases
against one live bug report, because no test named the noun the report did.

⚠️ A test that never asserts is worse than no test, because it counts. An `await` missing from an
async assertion asserts nothing at all and still shows as a pass.
