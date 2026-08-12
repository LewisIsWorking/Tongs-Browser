---
'tongs-browser': patch
---

Extract the whole diagnostics apparatus out of the composition root, into `DragObservers`,
`DragRecorder` and `DragDiagnostics`. **`TongsBrowser.ts` drops from 941 to 593.** 742 tests green.

The split follows the one distinction this entire investigation turned on:

- **`DragObservers`** are the listeners that watch a drag happen. All three are installed ONCE and
  left in place, never per gesture: a set per gesture leaks them across a scene change, and a
  diagnostic that has to be installed during the bug is a diagnostic nobody has when the bug happens.
- **`DragRecorder`** captures what is only knowable DURING the gesture. Foundry resets its
  interaction state the moment a drag ends, so anything read when the report is written describes the
  aftermath: the manager says NONE whether the drag never started or ran perfectly and committed.
- **`DragDiagnostics`** assembles and whispers the report, and reads only what the recorder already
  caught.

⚠️ **Recording and reporting being separate is the lesson of the whole session**, and it is now
structural rather than remembered. Five of the six defects found today were readings taken at the
wrong moment. The observers now expose ONE `snapshot()` rather than letting the reporter reach in
field by field, which is what made the four-reads-of-`getCounts` bug possible in the first place.

`SingleFingerPort` also moves to its own file, so the two halves of the gesture split can name it
without importing each other.
