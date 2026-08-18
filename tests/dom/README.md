# tests/dom

The half that needs elements: listeners, event phases, layout, and the bar. Run by the `dom` vitest
project against jsdom. Shared fixtures live in `support/`.

Representative files: `touchBinder.test.ts`, `touchBinderExcludedFinger.test.ts`,
`actionableTouches.test.ts`, `exclusionZones.test.ts`, `modifierBar.test.ts`,
`barHandleCarveOut.test.ts`, `foundryDragHooksIdempotence.test.ts`, `dragEndingSummary.test.ts`.

## What jsdom can and cannot tell you

It **can** tell you which listeners were registered, in which phase, whether `preventDefault` and
`stopPropagation` were called, and what the gesture layer reported. That covers most of the bugs this
module has had.

It **cannot** do layout. `offsetWidth` is always 0, nothing is ever really on top of anything, and
hit testing is a fiction. Anything that depends on a real box belongs in `tests/browser`, which runs
Chromium.

## The bug this folder is proudest of

`touchBinderExcludedFinger.test.ts` was written before the fix, failed 3 of 5, and the 2 that passed
were the ones that had to keep passing. `TouchEvent.touches` holds every finger on the _screen_, so a
thumb resting in the sidebar was counted as half of a two finger gesture and turned a token drag into
a pan. Found by reading, reproduced here, fixed at the boundary.

## Fixtures are shared, and adoption is checked

`support/` holds `touchEvents.ts`, `pointerHarness.ts`, `moduleUnderTest.ts`,
`diagnosticsSnapshot.ts` and `keyboardRecording.ts`. jsdom implements neither `TouchEvent` nor
`TouchList`, so touch events are plain `Event`s with a `touches` property defined on them - the
surface the binder actually reads.

⚠️ `npm run check:support` fails if a fixture under `support/` is imported by nothing. That has
happened twice: a fixture extracted "because both halves need it", after which both halves kept their
own hand copy anyway, so one field added to the snapshot had to be added three times.
