---
'tongs-browser': patch
---

Run the self-tests that two guards had implemented but nothing invoked.

`check-orphaned-docblocks.ts` and `check-scripts-load.ts` both shipped a `--self-test`, and neither
`npm run verify` nor CI ever passed the flag. The docblock guard went further and claimed
"PROVEN: `npm run lint:docblocks -- --self-test`", a proof that only existed in the commit that
wrote it.

Measured with the docblock predicate stubbed to `return []`: unwired it printed "No orphaned
docblocks across 319 files" and exited 0. Wired, it exits 1.

`tests/unit/guardSelfTests.test.ts` now requires that a guard implementing a self-test has an npm
script that runs it, and that the script still runs the guard against the repo afterwards - the
self-test exits 0 on its own, so wiring it in alone would be worse than not wiring it at all.
