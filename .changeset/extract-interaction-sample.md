---
'tongs-browser': patch
---

Fix the drag sampler reading the controlled token TWICE per sample, and extract
`debug/InteractionSample.ts` at 100% coverage. `TongsBrowser.ts` 1,078 to 1,051.

The sample reached `canvas.tokens.controlled[0]` once for the interaction state and again, a dozen
lines later, for the drag origin. Between those two reads a selection can change or a token can be
released, and the sample would then pair **one token's interaction state with another token's drag
origin**: a reading that describes no moment that ever existed, and which looks entirely ordinary in
the report.

The token is now resolved once and every field read off that one reference. A test proves it by
handing the reader a `controlled` array whose element changes on each access and asserting it is
touched exactly once.

**This is the fifth instance today of a single family**, and the fourth in the diagnostic itself: a
snapshot assembled from readings taken at different moments. The others were the move denominator
counting past the drop, Foundry's state read at several points, PIXI's pivot handed back live rather
than copied, and the PIXI counters read four times.

Also documented where it belongs: this is sampled **as it happens** rather than when the report is
written, because Foundry resets the manager to NONE the moment an interaction ends, so a reading
taken afterwards says NONE whether the drag never started or ran perfectly and committed.
