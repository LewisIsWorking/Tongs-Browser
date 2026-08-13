---
'tongs-browser': patch
---

Stop the drag diagnostics stacking themselves, and stop them blaming a drag that worked.

The observers were re-wrapped on every dispatched event, because the caller retries until the
interaction manager appears and the manager is unreachable until a token is controlled. Each retry
wrapped the already-wrapped Token prototype, so one real `_onDragLeftStart` announced itself once per
layer: a device reported ~150 drag starts and ~150 redraws for a drag that had exactly one of each,
and every token redraw in that session ran through ~150 frames of a probe that promises not to change
what it measures. Wrappers now carry a registry symbol and are installed at most once.

The report's verdict is now decided by the OUTCOME. It printed "a REDRAW cancelled the interaction,
which is why nothing was written" directly beneath "DID IT MOVE: YES (3100,2000 -> 3000,2200)": the
redraw branch was tested before the drop branch so it shadowed everything, and the claim about
writing was inferred from the mechanism rather than passed in. `describeTokenMovement` now returns a
verdict alongside its sentence, and the summary requires it.

Redraw notes read Foundry's actual cancel condition (`state > HOVER`) instead of asserting it, so an
ordinary redraw is no longer accused of destroying a drag it never touched.
