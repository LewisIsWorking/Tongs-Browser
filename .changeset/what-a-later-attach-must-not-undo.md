---
'tongs-browser': patch
---

Test what a later `attach` must not undo in the drag observers.

`attach` retries until Foundry exists, so it runs against a Foundry that is sometimes there and
sometimes not. Without the early return in `hookDragEndings`, a later attach re-runs the installer
against whatever is present now and assigns that over `hooksInstalled`: a scene change or a
deselected token is enough to make it false, and the report would then state the hooks were never
installed while they were installed and working.

The guard is also deliberately narrow, firing only when both are installed, because the manager
prototype is unreachable until a token has been selected. Mutation checked: removing the guard fails,
and widening it to `||` fails the partial-install case.

Project coverage to 97.88 statements and 96.02 branches.
