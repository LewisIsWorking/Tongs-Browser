---
'tongs-browser': patch
---

Stop the diagnostics reporting a drag gate it never measured, and measure the thing that decides it.

A device report read `DRAG GATE: peak distance 0.0px, needs >= 10`, which says the pointer stood
still. It says nothing of the kind. `peakDragDistance` starts at `0` and is only ever written when
Foundry's `screenOrigin` and PIXI's pointer are both readable; the same report said `origin=n/a`, so
the computation never ran and the **initial value was printed as though it were a measurement**. It
now says `NOT MEASURABLE` and explains that this is not a distance of zero.

The measurement that actually splits the problem is new: **how far our pointer got from PIXI's during
the drag**. Foundry gates a drag on PIXI's pointer and nothing else, and derives
`canvas.mousePosition` from it too, so when PIXI is not tracking the events we dispatch, every
position in the report except our own is describing a different pointer while reading as if it
described ours. That line is now labelled `canvas.mousePosition (PIXI's pointer, NOT ours)`, because
unlabelled it invited exactly the wrong conclusion: `insideSelectedToken: false` was perfectly true
about PIXI's pointer and silent about the virtual one.

Sampled during the gesture, not at report time, since by then the pointer is on whichever button was
tapped to produce the report.

Also refuted a plausible theory cheaply, and it is worth recording because it was wrong: Foundry does
**not** alias `screenOrigin` to PIXI's live pointer object. Measured `false` on 14.365, so the gate
distance is a real subtraction and an exact 0.0 is a real result rather than an artefact.
