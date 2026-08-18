# tests/dom/support

Fixtures shared by the DOM tests. Nothing here asserts anything.

| File                     | What it is                                                |
| ------------------------ | --------------------------------------------------------- |
| `touchEvents.ts`         | Touch events jsdom will accept                            |
| `pointerHarness.ts`      | A pointer wired to a document, ready to drive             |
| `moduleUnderTest.ts`     | The module started up in a test page                      |
| `diagnosticsSnapshot.ts` | One diagnostics snapshot, in the shape the report expects |
| `keyboardRecording.ts`   | Capturing what the keyboard synthesizer dispatched        |

## Why `touchEvents.ts` builds plain `Event`s

jsdom implements neither `TouchEvent` nor `TouchList`, so constructing one throws. These are plain
`Event`s with a `touches` property defined on them, which is exactly the surface `TouchBinder` reads.

⚠️ `TouchPointSpec` carries an optional `target`, added because its absence hid a bug. `touches` holds
every finger on the _screen_ and each `Touch` names the element it landed on, so a helper that could
not express a second finger somewhere else could not express a second finger in an **excluded** place,
which is the case the gesture layer got wrong.

## Adoption is enforced

`npm run check:support` fails if anything here is imported by nothing. That is not tidiness: a fixture
was once extracted "because both halves need it", and then both halves kept their own hand copy, so a
field added to the snapshot had to be added three times by hand. An extraction is finished when
nothing else does the job.
