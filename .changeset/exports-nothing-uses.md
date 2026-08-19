---
'tongs-browser': patch
---

Six dead exports removed, and a guard so they cannot accumulate again.

Three files in a row were opened because coverage was low, and each time the uncovered part was an
exported value nothing called. Coverage was the only thing pointing at any of it, and it answers the
wrong question: "untested" and "unreachable" need completely different work.

A sweep found ten. Six were unreachable and are gone (`findKey`, `hasAnyModifier`, `withButtons`,
`isButtonHeld`, `withButtonHeld`, and `ALL_KEYS`, which the typechecker exposed as dead by cascade
once `findKey` went). Four were live but over-exported and simply lost the `export` keyword.

`check:exports` now fails on an exported value nothing outside its file mentions, and distinguishes
the two cases, because "delete it" and "drop the export" are different fixes. It judges `src/` only,
and values only: including types produced 64 findings of which most were correct code, since an
`Options` interface is normally named only in its own file. Restricting to values produced 10, and
all 10 were real.

Proved by feeding it the bug: putting `isButtonHeld` back is reported by name with the right remedy.
The module bundle is 0.4 kB smaller.
