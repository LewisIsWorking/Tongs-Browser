---
'tongs-browser': patch
---

Extract `debug/TokenMovement.ts` at 100% coverage, and give the diagnostics report's most important
line a test of its own.

⚠️ **This is the only field in the report that answers the question anybody actually asked.** Every
other field describes EVENTS: what was dispatched, what state Foundry reached, how far the pointer
travelled. All of those can look perfectly healthy while the token sits exactly where it started,
which is precisely what happened for three rounds of diagnosis.

The distinction now pinned, which had never been asserted:

> **The two "cannot say" answers are DIFFERENT strings, and neither is a NO.** "No grab recorded"
> means the button was never pressed, so the report is about nothing. "No token selected now" means
> the selection was lost between the grab and the report, which is itself a finding: a token that
> deselects mid drag is one of the ways a drag silently ends.
>
> Collapsing either into NO would report a failure that was never measured.

Also recorded: both coordinates print whatever the answer, because a bare NO leaves open whether it
was even the same token; the comparison is exact rather than tolerant, since Foundry snaps a dropped
token to the grid so a committed move is always a whole square; and a coordinate of zero is a real
position rather than a missing one.

`TongsBrowser.ts` 1,080 to 1,075. 700 tests.
