---
'tongs-browser': patch
---

Fix the live sheet checks reporting the module's own gate as two module failures.

They were written against `FOUNDRY_USER=Gamemaster`, the default, and named their assertions "for a
GM" while never establishing that they were one. Run as a player, which nothing had ever done, they
reported the create and party-access buttons MISSING. Both are correctly hidden from a player with no
party opened, so the harness was accusing the feature.

The expectation now depends on who is looking, and says which case it judged. A GM sees both. A
player never sees party access. A player sees create only where a GM has opened a party, so in a
world with no parties its absence is the gate working and its presence would be the bug; in a world
that does hold parties the case skips, because whether one is open is the decision under test and
asserting either way would be asserting the module's own answer back at it.

The decision is a pure function so all four cases are proven without a Foundry. The GM branch could
not be run when this was written, since that account has a password.
