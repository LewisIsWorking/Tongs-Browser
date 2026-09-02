---
'tongs-browser': patch
---

Add the write half of the party flag, so a GM can actually open a party to players.

`PartyAccess` could already read `allowPlayerCreation` and nothing could set it, which left
requirement 2 as a rule with no way to opt in: every party closed, permanently, and the only symptom
would have been a player told to ask their GM by a GM with no way to say yes.

It writes the value it is given rather than toggling what it read. A toggle computed here would be a
read-modify-write across a network, and two GMs tapping at once would land the party wherever the race
left it.

Row labels name the state rather than the action, because on a list where some are on and some are
off, only "open to players" can be read at a glance.

Also records the 2026-09-02 Android run: 16 passed, 0 failed, 3 hover skips on v0.25.94.
