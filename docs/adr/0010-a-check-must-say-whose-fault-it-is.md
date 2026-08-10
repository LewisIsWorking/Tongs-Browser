# 0010. A device check must establish whose fault a failure is

Date: 2026-08-10

Status: accepted

## Context

Adding hover coverage to `check:android` produced four confident red results in one run. Every one of
them was about this module. Exactly one of them was true.

Hover is the item `docs/MANUAL-TESTING.md` calls "the whole reason this exists", and ADR 0005 was
careful to say that tracking `canvas.mousePosition` is a strictly weaker claim than hovering. A
pointer can update the mouse position perfectly while Foundry never runs a hover transition, and the
user would see a cursor gliding over tokens that never light up and never open a PF2e HUD panel.

## Decision

When a device check fails, it runs a **control** that bypasses the module and does the same thing by
the most direct means available. The control decides how the failure is reported:

| control  | meaning                                   | reported as               |
| -------- | ----------------------------------------- | ------------------------- |
| succeeds | the environment can do this, we could not | **FAIL**, ours            |
| fails    | the environment cannot do this at all     | **SKIP**, with the reason |

A skip is never a pass, and the reason always names what the control did.

## What this immediately caught

**Hover: not our bug.** The module's `moveTo` did not hover a token on the emulator. A hand built
`pointermove` at identical coordinates did not either, while Foundry's own `_onHoverIn` proved the
token could hover. The same control on desktop Chrome hovers successfully with both. Same module,
same Foundry 14.365, same PIXI 7.4.3, different Chromium. Reported as a skip naming Chromium 146.

Without the control this would have been filed as a hover dispatch bug, and the fix would have been
applied to code that is already correct.

**Tap: probably ours, and still open.** The reverse case. The tap delivered `pointerdown`,
`mousedown`, `pointerup` and `mouseup` to the correct sidebar tab, at the right coordinates, and no
`click` ever arrived, so the tab did not change. A plain scripted click on the same element does
switch it. The environment is fine, so this is reported as a failure.

⚠️ Not yet explained, and deliberately not guessed at: `buildLeftClickSequence` does append a click,
and this same check passed earlier in the same session on the same emulator and browser against a
Simple Worldbuilding world. The regression coincides with the world changing to one running the coo
system. It is **not** the modifier bar change from ADR 0009: the run that first reported zero
controls off screen also reported this check passing.

## Two smaller lessons from the same run

- **A coordinate cross check tells a conversion bug from a behaviour bug.** The first hover attempt
  aimed at client `(-769, -584)`: the maths was right and the token was simply off view on a 3000px
  scene at 0.5 zoom. Asserting that Foundry reads the mouse _inside the token_ turned an inscrutable
  hover failure into an obvious panning omission.
- **`createEmbeddedDocuments` resolves before the placeable is drawn.** Reading a baseline
  immediately reports `nameplate.visible` as null, and a freshly drawn token carries `visible: true`
  until the first refresh applies `displayName`. So the baseline reports nameplates rather than
  asserting them, and only the transition is asserted.

## Consequences

- `check:android` currently exits non zero on the tap result. That is correct: it is a real red.
- The hover assertions cannot be satisfied on this emulator at all. Closing them needs a device with
  Chromium 146 or newer, which is also what Foundry 14.365 asks for.
