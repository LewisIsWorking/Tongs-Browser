---
'tongs-browser': patch
---

Bring the last 119 type errors in the harness scripts to zero, and put `typecheck:scripts` inside
`verify` so they cannot come back.

Four of these were real defects rather than missing annotations, and they were all the same shape:
an annotation that described what somebody needed three lines earlier rather than what the value is.

- **`captureAttributedErrors` declared `string[]` and pushed objects**, then read `.stack` off them.
- **`(o: HTMLOptionElement) => o === 'yes'`**, four times, on what are trial outcome strings. Every
  one of those comparisons was **always false** at type level.
- **`play-probe`'s `CheckResult` was a copy of another check's shape** and did not describe a single
  row this file builds.
- **The keyboard control's `reason` was `string | undefined`**, so the unusable branch reported its
  failure with a detail of literally `undefined`. That detail is the entire finding: "Foundry ignored
  the event" and "there is no `downKeys` to look at" are different problems with different fixes.

Two robustness bugs fell out on the way:

- The tap control read `tab.addEventListener` with no null guard. A missing tab threw **inside the
  page**, which took down the whole run. The one thing written to establish whose fault a failure is
  would itself have become the failure.
- `barControls` spread a possibly null rect, so a control with no coordinates printed `at x NaN-NaN`
  in the very failure message meant to say where it had gone.

`FoundryToken` was written twice and had already drifted: one copy knew about `nameplate` and not
`w`/`h`, the other the reverse. Both now come from `scripts/foundry-types.ts`, so drift between
copies is not expressible. `#board` was queried in four scripts and is now `boardBox`/`boardCentre`,
which throw rather than returning (0, 0): a fallback there presses the corner of the window and
produces a plausible looking FAIL for whichever behaviour was under test.
