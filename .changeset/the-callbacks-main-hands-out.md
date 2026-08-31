---
'tongs-browser': patch
---

Test the three callbacks `main.ts` hands out and nothing invoked.

All three are read live rather than captured, which is what lets a setting take effect without a
reload, and is also why none of them ran at startup and none was reached by a test that only booted
the module.

The suppressor's `enabled` predicate is an AND of two settings, and getting it wrong is not cosmetic:
suppressing while the module is OFF eats touch events Foundry needs, for a user who most likely
switched it off because something was misbehaving. The truth table is now asserted in full, and
`&&` becoming `||` fails.

`main.ts` goes 50% to 90% of functions, project coverage to 96.84 statements and 95.41 functions.
