---
'tongs-browser': patch
---

Record the peak interaction state during a gesture rather than reading it afterwards.

The first report carrying Foundry's interaction state said `NONE (0)` with zero drag previews, which
looks conclusive and is not: it was read when the report was written, which is after the gesture
ended, and Foundry resets the manager to NONE once an interaction finishes. A post hoc NONE says the
same thing whether the drag never started or ran perfectly and committed.

The state and the drag preview count are now sampled on every dispatched event and the peak since the
last `pointerdown` is reported. That survives the gesture ending, which is the only reason it can
answer the question: a peak below GRABBED means the moves never reached Foundry's manager, while a
peak of DRAG with previews means the drag ran and the drop is what failed.

Same class of mistake as asserting a sign where a magnitude was meant. A measurement has to outlive
the thing it measures.
