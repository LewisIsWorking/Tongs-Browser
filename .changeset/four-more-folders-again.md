---
'tongs-browser': patch
---

Four more folders documented: `src/debug`, `src/pointer/sequences`, `src/ui`, `src/relay`. Nineteen
of twenty-six now carry a README that names its own files; seven remain.

`src/debug` is the largest folder in the module and its README says why: most failures there are
silent, so everything in it exists to turn a silence into a sentence. It records the four rules that
suite runs on, including the one it keeps having to relearn - that when this folder reports a
capability broken, the instrument is usually the thing that is wrong.
