---
'tongs-browser': patch
---

Cover the party path for real, against real PF2e.

The live sheet check had carried a note since 2026-09-03 saying the party path was not covered
because no PF2e-family world was available. One is now. Running it against PF2e 8.5.0 on Foundry
14.367 turned up three things, none of which was a module bug.

**The note could never have changed its mind.** It was an unconditional string, printed on every run
whatever the world held, so the gap it described could not close and nobody reading the output would
have known if it had. It also named `status.world` while calling it what the world "runs":
`/api/status` returns BOTH `world` (the world's id) and `system`, and against a real PF2e world the
note printed "it needs a PF2e-family world; this one runs 'tongs-pf2e'", which is the world id, and
is a PF2e world. It now reads `system` and says which of the two cases applies.

**Two checks failed while the module was correct.** They hard-coded the no-party notices, which are
only right in a world holding no parties, and PF2e creates a party actor with every new world. So the
module rightly offered a picker and the harness called it a failure. `checkNoticeText` is deleted and
replaced by `pressOutcomeFor`, a pure function that takes what the world holds and derives what
should happen, so one check is correct in both worlds and neither has to be the "supported" one.

**A brand new PF2e world would have made the harness write to it.** `CreateSheetFlow` collapses every
step that has only one answer: one party skips "which party?", one assignable user skips "who plays
them?". A world with one of each therefore creates an actor on the FIRST TAP with nothing shown in
between, and a brand new PF2e world is exactly one party and one user. The harness promises in its
own docblock that it writes nothing, so that promise was one tap from being false in the most
ordinary world there is. That case is now recorded as a skip naming the reason, which is a fact worth
having rather than a hole: it says the module would create, and that the check declined to.

What is now genuinely proven against real PF2e, rather than against sf2e as a proxy: the party access
button opens a picker that lists the world's actual party actor by name. A picker built from an empty
array still renders, so the assertion is that the real party is named in it, not that a menu appeared.
