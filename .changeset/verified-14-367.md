---
'tongs-browser': patch
---

Declare Foundry 14.367 as the verified build.

`compatibility.verified` still named 14.366, but every live measurement since the keybinding snapshot
was re-taken has been against 14.367, including creating a character sheet into a party and the
diagnostics report on PF2e 8.5.0. The release checklist requires that field to name the build actually
tested. The Forge and Foundry show a module as unverified for your version based on it, so a stale
value makes a module that was tested on your build look as if it was not.

The README status line and compatibility note are brought up to date to match, and now say plainly
that the manifest's `minimum` and `maximum` are both `14`, so a v13 world will refuse to install it.
