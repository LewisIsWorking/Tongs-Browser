---
'tongs-browser': patch
---

Report Foundry's own interaction state in diagnostics, and trace a whole gesture.

The pointer capture fix landed and the events now demonstrably reach `canvas#board` with
`buttons=1`, and a token on a real device still does not move. Correct events arriving at the right
element and nothing happening is a different problem from the one just fixed, and nothing visible
distinguishes its two possible causes.

So the report now carries Foundry's own `MouseInteractionManager` state for the selected token, which
runs NONE, HOVER, CLICKED, GRABBED, DRAG, DROP with a 10px drag resistance, plus whether a drag
preview object exists. If the state never leaves CLICKED or GRABBED, the moves are not reaching the
manager. If it reaches DRAG and a preview exists, the drag is running and the drop is what fails.

The event trace now covers a whole gesture rather than a fixed last eighteen. A drag emits a move per
step, so the `pointerdown` that began it had already scrolled out of the window by the time the
report was read, and whether the press and the release reached the same element is exactly the
question being asked. Runs of identical moves are collapsed rather than filling the report.
