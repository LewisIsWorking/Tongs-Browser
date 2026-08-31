---
'tongs-browser': patch
---

Test the two `DragDiagnostics` callbacks, both of which lose a diagnostic silently when unwired.

`onObservation` carries what Foundry did into the journal, which is the one place a Foundry action
sits beside the button press that caused it. `fallback` is the last resort when there is no chat to
whisper into, and chat is the only diagnostic channel a phone has.

The report renders either way, so a lost input looks exactly like a quiet session. Mutation checked:
dropping either callback, or the no-game guard, fails.

`DragDiagnostics` reaches 100% of statements, functions and lines; project coverage to 97.26
statements and 96.51 functions.
