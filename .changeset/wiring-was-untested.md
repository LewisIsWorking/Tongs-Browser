---
'tongs-browser': patch
---

`FoundryActions` was 60% covered, and the untested part was the wiring rather than the decisions.

Every decision the tray buttons make already lives in its own tested module. What nothing covered was
whether each decision reaches the effect it names, which is exactly where a regression is silent: the
decision modules stay green while the button does nothing, or does the wrong thing.

Three mutations, each a plausible edit, now turn a test red:

- dropping the relay branch, which makes a player's pause button do nothing at all. Foundry's
  `Game#togglePause` only emits `if (options.broadcast && game.user.isGM)`, so a player toggling
  locally changes nobody else's client, and macro ownership cannot fix it because the check is on the
  emit path.
- letting `closeMenu` fall through to `openMenu`, which leaves a picker that cannot be dismissed. On a
  phone there is no click elsewhere to close it.
- replacing the designated-GM check with "am I a GM", which has every connected GM act on one relayed
  request, flipping the pause once per GM and landing wherever the race ends.

`src/foundry` goes to 95.8% statements and 97.1% branches; the project 92.6% to 93.1%.
