# tests/unit/support

Fixtures shared by the pure tests. No DOM, no assertions.

| File                   | What it is                                  |
| ---------------------- | ------------------------------------------- |
| `gestureHarness.ts`    | A gesture machine plus a clock you control  |
| `gestureController.ts` | A controller with its collaborators stubbed |
| `sequenceHarness.ts`   | Building and inspecting event sequences     |

## Time is an argument here

`gestureHarness.ts` exists so tests can say "now 400ms have passed" instead of waiting. The gesture
machine takes time as an input and never reads a clock, which is what makes long presses, double taps
and their interactions testable in milliseconds and immune to flake.

A test that waits for a real timer is a test that will eventually fail on a loaded CI machine, and
the failure will look like a bug in the gesture rather than in the test.

## Adoption is enforced

`npm run check:support` fails if a module here is imported by nothing, so an extracted fixture cannot
sit unused beside the hand copies it was meant to replace.
