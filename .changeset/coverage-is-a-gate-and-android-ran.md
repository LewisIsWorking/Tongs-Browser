---
'tongs-browser': patch
---

Make coverage a gate, and record the first harnessed Android run.

Coverage was measured and never enforced. `test:coverage` existed and neither `verify` nor CI ran it,
so the figure appeared only when somebody typed the command. Thresholds are now on with
`autoUpdate`, which makes them a ratchet: they rise when coverage rises and fail when it falls. The
target is 100%; the seeded mark is 95.66% statements, 93.21% functions.

`npm run check:android` ran against real Android for the first time, on an emulator: 16 passed, 3
skipped, 0 failed. Foundry honours synthesised keyboard events on Android (`events`), measured twice
independently. Tap-clicks-at-the-pointer verified on real touch hardware. The three skips are hover,
which Chrome 133 cannot express from any scripted event, module bypassed or not.
