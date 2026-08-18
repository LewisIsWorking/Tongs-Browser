---
'tongs-browser': patch
---

The entry point had no tests at all.

`src/main.ts` was at 0% coverage, and it is the file that decides whether the module loads. Every
failure it can have is silent and total: no settings, no scene control, no API, and a console that
says nothing unusual. Nothing short of a live run would have caught one.

Nine tests now cover it, asserting outcomes a regression would break rather than that particular
functions were called. The most valuable is a regression test for a bug that shipped: the scene
control must be bound at `init`, not `ready`, because Foundry builds its controls exactly once and a
listener added later has already missed it. Measured on 14.365, the button simply never existed and
nothing logged.

Every test was mutation checked. Moving `toggle.bind()` to `ready`, dropping `moduleEntry.api`,
inverting the enabled check, and cutting the settings change off from the instance each turn a test
red. `main.ts` goes from 0% to 80.6%, `src/` from 65% to 84%, the project from 89.7% to 91.3%.
