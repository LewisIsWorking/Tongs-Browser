---
'tongs-browser': minor
---

**The viewport resize hypothesis is dead**, and the report now says whether it is watching at all.

A device on 0.24.4 reported `0 resizes during the drag` with the viewport identical at the grab and
at the report. Foundry redraws on resize and there were no resizes, so the redraw theory is finished.
That line was built so a zero would kill it, and it did.

The same report exposed a worse problem, and it is the same mistake this report has now made four
times. It said `NOTHING observed` while the drag origin was demonstrably being wiped, 2 samples out
of 227 moves. **Those two facts cannot both be true of a watched drag.** They are trivially both true
of an unwatched one, and nothing in the report said which it was: `installFoundryDragHooks` returns
false when Foundry is not ready, and that answer went nowhere.

So the line now distinguishes three states that were one:

- **NOT WATCHING** when the observers never installed, saying outright that the line means nothing
- **NOTHING observed, and the observers ARE installed**, which is a real finding about Foundry
- **the MANAGER hook never installed**, which matters because a cancel arriving at `GRABBED` never
  reaches the token callbacks at all, only the manager

The manager prototype is reached through a live controlled token, so "token hooked, manager not"
is a normal state rather than an error, and it now has to be visible rather than inferred.
