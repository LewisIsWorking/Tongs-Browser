---
'tongs-browser': patch
---

Split `tests/dom/gestureLayer.test.ts` (498) into four suites, and add `npm run prune:imports`, a
tool that removes unused imports by asking the compiler rather than guessing.

**The tool exists because splitting one file into four cost four rounds of hand pruning.** A regex
looking for the identifier in the body gets it wrong in both directions: it counts a name inside a
`describe('VirtualPointer hover', ...)` TITLE as a use, and it counts one inside a comment. Both
happened today, and both left an import the compiler then rejected. TypeScript already knows the
answer exactly, so the tool asks it and edits what it points at.

Two things it got wrong first, both now recorded beside the code:

- **`TS6192` names nothing**, because the whole declaration is unused. Handling only `TS6133` left
  three files behind while the tool reported success.
- **An empty name has to short circuit.** Without that branch the name based path runs with an empty
  string, `includes('')` is true, and the replacements match at position zero and corrupt the
  statement rather than removing it.

`makeTouchEvent` moves to `tests/dom/support/touchEvents.ts`, where the reason it exists is written
down: it is a plain `Event` with `touches` defined ON it, not a `TouchEvent`, because jsdom
implements neither `TouchEvent` nor `TouchList` and constructing one throws.
