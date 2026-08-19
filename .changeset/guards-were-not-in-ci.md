---
'tongs-browser': patch
---

Five guards were not running in CI, including the 200 line limit.

The CI job ran `lint`, `typecheck`, `test` and `build`. It did not run `check:sizes`,
`check:readmes`, `check:scripts`, `check:support` or `typecheck:scripts`, all of which exist only
inside `npm run verify` and were therefore enforced nowhere except a developer's memory. A 232 line
test file merged green, which is how it was noticed.

CI now runs `npm run verify`, naming the composite script rather than re-listing its parts, so a
guard added to `verify` is a guard CI runs.

Also removes `onNativePointer` from `TouchBinder`, which could never fire: it was in the handler
union, implemented, and wired into `bind()`'s lookup table, but no listener spec named it, so it was
never registered. The suppression it appeared to perform genuinely lives in `NativePointerSuppressor`,
bound on the window because PIXI binds there first. A test now asserts the handler names and the specs
match in both directions.

Coverage: `SettledStates.ts` 61% to 88.9% statements and 50% to 90% branches, covering the
interruptions a tablet produces rather than the ordinary path; `TouchBinder.ts` 76% to 92.7%; the
project 91.3% to 92.3%.
