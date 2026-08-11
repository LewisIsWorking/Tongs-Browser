---
'tongs-browser': minor
---

Report the build version and the actual event stream in diagnostics.

A drag failure on a real device produced a report where **every static check was healthy**: `select`
tool, `_canDrag: true`, pointer genuinely inside the selected token, canvas ready. At that point the
setup is not the problem and the only thing left to look at is the event stream itself, which on a
phone has no console to look at it in. The report now carries the last eighteen dispatched events
with their `buttons` value, which is the field that decides whether a drag is a drag: it must stay
non zero on every move between the down and the up, or Foundry reads the stream as a hover.

⚠️ The same report also claimed version 0.2.3 while running code from 0.9.0, and that is worth
fixing rather than explaining away. `game.modules.get(id).version` comes from a manifest Foundry
reads **once at server start** and caches, so replacing module files under a running server leaves it
frozen at whatever booted. The version is now stamped into the bundle at build time and both are
shown, so a mismatch is visible rather than misleading.
