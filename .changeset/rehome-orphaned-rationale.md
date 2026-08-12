---
'tongs-browser': patch
---

Re-home five orphaned docblocks onto the fields they actually describe, and split `debug/Peak.ts` and
`debug/DragMeasurements.ts` out of the sampler.

⚠️ **The rationale did not survive an earlier extraction.** When the drag measurements moved into
`DragSampler`, the field declarations went and the comments did not. Five large blocks were left in
`TongsBrowser` with nothing beneath them, so they had drifted to sit above an unrelated field and read
as documenting it. They were also the ONLY copy: none of that reasoning existed anywhere else.

What they record, now beside the fields they belong to:

- **A zero that measured nothing looks exactly like a zero that measured a still pointer.** The gate
  peak starts at 0 and is only written when both Foundry's `screenOrigin` and PIXI's pointer are
  readable, so a report printed "peak distance 0.0px, needs >= 10" for a measurement that never ran.
- **`0.0px over 47 samples` is evidence; `0.0px over 1 sample` is noise wearing the same clothes.**
  This mistake was made three times in one investigation.
- **Two completely different bugs both produce `gate distance 0.0` and a token that does not move**,
  and their fixes share no code. Measuring our own travel against our own grab point touches no
  Foundry state, so it cannot be confounded by whatever Foundry is doing.
- **`screenOrigin` is PINNED on desktop and under emulated touch**: 800 across twelve steps, 683
  across twelve more. So an origin that follows the pointer is not something the module does in the
  ordinary case.

`TongsBrowser.ts` is under 1,000 for the first time, at 970 from 1,853 this morning. Moving the
comments took `DragSampler` over the limit, so `Peak` and the sampler's input and output contracts
now have their own files and it is back to 190, under.
