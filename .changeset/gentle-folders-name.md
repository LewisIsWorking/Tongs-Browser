---
'tongs-browser': patch
---

Four more folders documented: `src/pointer`, `src/modifiers`, `src/settings`, `src/scaling`. Ten of
twenty-six now carry a README that names its own files; sixteen remain on the backlog.

These record the measurements rather than indexing the files: why `button` and `buttons` are
different fields and getting it wrong produces events Foundry quietly ignores, why the keyboard
strategy probe decides whether the modifier bar works at all, why the exhaustive switch in
`ApplySetting.ts` has no default branch, and why scaling the whole document would move the one thing
that must not move.
