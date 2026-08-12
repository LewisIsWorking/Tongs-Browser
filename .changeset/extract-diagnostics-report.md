---
'tongs-browser': patch
---

Extract the diagnostics report into a pure builder, at 100% coverage.

`debug/DiagnosticsReport.ts` takes an explicit snapshot and returns lines. It reads nothing and asks
nobody, which is what finally makes the report testable, and this report has been wrong about its own
numbers three separate times. Each time a line stated something the code had not measured, and each
time it sent the investigation somewhere it did not need to go.

The tests now assert the claims that misled, rather than trusting them:

- a peak that was never sampled says **NOT MEASURABLE**, never a confident `0.0px`
- a peak sampled for almost none of the gesture disowns itself, with the move count as denominator
- `needs >= 10` appears only beside a real reading, never beside a refusal
- the explanation says the data was **WIPED**, and there is a test asserting it does not say
  "transient", which is what this claimed for three releases and was wrong: `interactionData` is a
  plain property that persists until `reset()`, so thin sampling is a finding rather than a
  measurement error

The line ORDER is asserted too, because it is load bearing rather than cosmetic: a phone chat window
shows roughly fifteen lines and truncates the rest silently, and an earlier report was cut off exactly
at the field the round existed to read.

`TongsBrowser.ts` is down from 1,853 to 1,637 across today's two extractions.
