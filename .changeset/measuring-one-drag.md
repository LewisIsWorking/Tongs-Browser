---
'tongs-browser': patch
---

`DragObservers` was 75% covered with 33% of branches, and the untested half was the counting rules
rather than the wiring. Those rules decide whether the numbers in a diagnostic report describe the
drag being investigated or the one before it.

Now asserted: resizes are counted only while a drag is open, the listener is already running before
any drag begins (one added at the grab would miss a resize caused by the grab, which is the case
under suspicion), and every counter is cleared when a fresh drag opens. Attaching before Foundry
exists reports the hooks as not installed rather than claiming success, and can be retried, which is
the normal case.

⚠️ One test was rewritten after mutation checking showed it could not fail. "Starts with no drag
endings recorded" asserted an empty list on a fresh observer, which is empty whether or not
`beginDrag` clears anything. It now produces a real ending first by installing the hooks against a
stand-in Foundry, which also proves the wrapping reaches its observation sink at all.

`DragObservers.ts` 75% to 96.6%, `src/debug` to 97%, the project 94.6% to 94.9%.
