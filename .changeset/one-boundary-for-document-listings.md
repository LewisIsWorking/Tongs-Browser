---
'tongs-browser': patch
---

Add `check:documents`, so every listing of Foundry documents goes through one boundary.

Groundwork for the character sheet creation feature, whose pickers will be the first place this module
has ever listed documents. Listing is the only thing it does that can leak a name the user has no
permission to see; everything else is about a pointer.

The guard found something a hand grep had missed: `FoundryActions.openCharacterSheet` enumerates
`game.actors`, and the audit that preceded it searched for `game.actors` with an unescaped dot, which
cannot match `game?.actors`. That code is correct and is allowlisted rather than changed: it filters
to `isOwner === true` immediately and opens a sheet only when exactly one survives.

Also adds `docs/CHARACTER-SHEET-CREATION.md` and a read-only permissions probe.
