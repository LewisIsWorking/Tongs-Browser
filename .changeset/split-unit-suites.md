---
'tongs-browser': patch
---

Split `gestureStateMachine.test.ts` (407) and `sequences.test.ts` (297) into focused suites with
shared harnesses. 766 tests green, the same 766 as before.

Two mistakes worth recording, because both produced a GREEN suite with tests missing:

⚠️ **The splitter deleted a file it had just written.** One output filename is the input path, and
the `unlink` at the end removed it. The suite went from 766 tests to 754 and still reported "78 files
passed": a deleted test file is not a failing test file. The count is the only thing that catches it,
and it is not something a green tick tells you.

⚠️ **`prune:imports` correctly removed imports the harness held only to re-export.** They are
genuinely unused BY that module. The fix is order, not an exception: build the re-exports first, then
prune. The reason is now written where the re-exports are.

Also fixed: `verbatimModuleSyntax` requires `export type` for a re-exported type, which is a separate
list from the values.
