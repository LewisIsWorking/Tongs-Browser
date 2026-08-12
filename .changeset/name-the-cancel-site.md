---
'tongs-browser': patch
---

Name WHICH of Foundry's cancel sites fired, from the call stack.

⚠️ **The event alone cannot answer this, and three rounds of diagnosis assumed it could.** Foundry
reaches `cancel` from several places, and one of them is a long press TIMEOUT whose closure still
holds the original `pointerdown`. So a cancel stamped `pointerdown` may have happened half a second
later, from a timer, and reading it as "the pointerdown caused it" is wrong in a way nothing else in
the report contradicts.

The three paths are three different bugs with three different fixes, and they are indistinguishable
without this:

- `#handleDragStart` refusing at `can("dragLeftStart")`, which cancels outright
- `#handleDragCancel` from a pointerup
- the long press timer

Our own frames are skipped: naming the wrapper that records the observation says only "the observer
observed", which is the kind of true and useless line this report already has too many of.

The test matches the call site loosely on purpose. Which frame appears depends on the runtime, and
pinning the exact string would make it a test of Node's stack format rather than of the report.
