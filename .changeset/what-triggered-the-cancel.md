---
'tongs-browser': patch
---

Say what TRIGGERED Foundry's drag cancel, and lead the report with the build number.

A device answered the last question outright: `_onDragLeftCancel` three times and `_onDragLeftDrop`
never. Foundry is not failing to write the move, it is **cancelling the drag before it gets that
far**. That is a completely different fix from a refused write, and it is the first time the two have
been distinguishable.

"Something aborted the drag" is not a lead, though. Foundry hands the cancel handler the event that
caused it, so the report now prints that event's type, button, pointer type and pointer id. Those
separate the candidates that actually differ:

- a right click, which is how a mouse user cancels a drag on purpose
- a second press arriving mid drag
- a cancelled pointer
- **no event at all**, which would mean Foundry cancelled of its own accord rather than in response to
  input, and would move the search inside Foundry rather than inside this module

The build number is now the first line of the report rather than buried two thirds down. It is the
sanity check every other number depends on, it is stamped by Vite at build time so it cannot go stale,
and it is the one thing worth reading before anything else. The `manifest says` value beside it is
Foundry's cached `module.json`, read once at server start, and a mismatch there is expected rather
than a problem.
