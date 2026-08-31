---
'tongs-browser': patch
---

Record that a warm emulator fails the tap check on a correct module.

Re-running `check:android` a day after the first successful run produced a failure on the module's
central premise: tap clicks at the pointer rather than under the finger. It was reproducible, four
times.

It is not a regression, and that was established rather than argued: `v0.25.68`, the exact build that
had passed, was checked out, rebuilt and re-run, and failed identically. Cold booting the emulator
fixed it outright, twice in a row, with nothing else changed.

Cold boot the emulator before any run whose result you intend to record. A warm one manufactures a
false failure on the most important check in the suite, which is the kind of red that gets a correct
module "fixed".
