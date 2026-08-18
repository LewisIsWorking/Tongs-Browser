---
'tongs-browser': patch
---

The file size ratchet only enforced half of what it promised.

Its docblock says the ceiling is each file's current length, and warns that "a ratchet parked at a
comfortable margin is a high water mark". The code checked `lines > ceiling` only, so a file that
SHRANK kept its old ceiling until somebody remembered to run `--update` - and could then silently
regrow every line it had lost, with the check green throughout. The margin it warns about could open
up on its own.

Slack now fails the check, with the one command that records it, and a different message from the one
shown for growth: "extract a responsibility" is the right advice for a file that grew and precisely
the wrong advice for one that shrank. `--update` still runs while slack is outstanding, since
recording the reduction is its entire purpose.

Proved by feeding the guard the bug: an inflated ceiling of 300 against a 284 line file reported
green before and now exits 1.

Also, `--self-test` now actually runs. It was reachable only by hand and appeared in no npm script and
no workflow, so the guard's own proof had never executed in CI. `check:sizes` runs it first, and the
same rules are now covered by ordinary unit tests as well.
