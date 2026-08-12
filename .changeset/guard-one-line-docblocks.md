---
'tongs-browser': patch
---

Teach the orphaned docblock guard about ONE LINE blocks, which it was walking straight past, and
clear the three it then found.

⚠️ **The guard had a gap of exactly the kind it exists to catch.** A multi line block closes on a
line of its own, so a check for a lone closing marker finds it. A one line block, `/** ... */`,
closes on the same line it opens, and the check skipped every one of them. Two had been sitting in
`TongsBrowser` since an earlier extraction, documenting fields that had moved into `DragSampler`, and
the guard reported the file clean.

The self test now has its own case for the one line shape, so the same gap cannot reopen.

What the three were:

- Two field descriptions whose fields moved to `DragSampler`, now beside them there.
- A duplicate left when `describeTokenMovement` was extracted: the newer block says the same thing
  and names the module it moved to.

This is the third time today that a guard or a test proved to be structurally incapable of catching
what it named, after the jsdom clamp tests that could only ever run against a zero sized bar, and the
reset test that passed with and without the line it claimed to guard. The pattern is worth stating
plainly: **a check that has never been shown to fail is a claim, not a guard.**
