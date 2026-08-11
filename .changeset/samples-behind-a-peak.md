---
'tongs-browser': patch
---

Report how many samples are behind every peak in the diagnostics, and rule out canvas panning.

A peak is not a measurement over a gesture. It is a measurement over however many samples it happened
to get, and those are the same thing only when the sampling covers the gesture. That distinction has
now been the same mistake three times in one investigation:

1. a `0.0px` that had sampled **nothing**, printed beside its own threshold as though the pointer had
   stood still,
2. a `0.0px` peak that may have sampled only the **first move**, when the pointer was still sitting on
   its own origin and zero was the correct answer to a question nobody wanted asked,
3. and that second zero was used to conclude that Foundry's drag origin follows the pointer, which is
   a strong claim to rest on a number that might have one sample behind it.

Every peak now reads `X px over N samples`, above a `drag moves dispatched: M` line that is the
denominator for all of them. `0.0px over 47 samples` is evidence. `0.0px over 1 sample` is noise
wearing the same clothes, and until now the two were indistinguishable.

Also refuted, by measurement rather than argument: **panning the canvas during a drag does not move
`screenOrigin`.** It stays pinned at 800 across twelve steps while the canvas moves under it. The new
`npm run check:drag -- --pan` covers it, and it is worth keeping for a second reason: it made the
token overshoot to 500px for a 240px drag, which the distance assertion caught. Before that assertion
existed this check would have called that a pass.
