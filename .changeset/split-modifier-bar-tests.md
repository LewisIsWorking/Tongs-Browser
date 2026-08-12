---
'tongs-browser': patch
---

Split `tests/dom/modifierBar.test.ts`, at 825 the largest test file, into focused suites with a
shared recording harness. 750 tests green, none changed in meaning.

The recording helpers were the reason the file kept growing: every suite that touches a modifier key
needs the same keyboard listener, the same `recorded` array and the same bar factory. They now live
in `tests/dom/support/keyboardRecording.ts`, shared rather than copied, because five copies of a
listener appending to a module level array is five chances for one of them to forget to reset it.

⚠️ **One thing the split nearly broke, and it is worth recording.** Several tests clear `recorded`
MID TEST, not just in `beforeEach`, to isolate a phase: press, clear, release, then assert only the
keyup arrived. A first pass treated those as duplicates of the setup and removed them, which left six
tests asserting on the press as well as the release. They are conversions, not deletions: the shared
array is emptied in place rather than reassigned.

`createBar` throws rather than returning null for a missing key, because a missing key is a broken
bar and not an empty assertion.
