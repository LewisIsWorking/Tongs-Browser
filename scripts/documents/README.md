# scripts/documents

The rule behind `npm run check:documents`: every listing of Foundry documents in `src/` goes through
one boundary, so the permission filter is written once.

- **`rules.ts`**: `findDocumentAccess` spots `game.actors`, `game.folders`, `game.users` and the rest
  in a source file, and `selfTest` feeds it a real enumeration, the allowed `activeGM` lookup, a
  comment, and a case that checks the reported line number.

## Why a boundary rather than a rule people follow

Listing documents is the only thing this module does that can leak. Everything else is about a
pointer, and a pointer cannot tell a player the name of a sheet, party or folder they were never
meant to know exists.

A rule applied at N call sites is eventually applied at N-1. `ActionableTouches` takes the same shape
for the same reason: excluded fingers are filtered at one boundary rather than at each place that
handles a touch.

## Two things this guard already taught us

⚠️ **A hand grep missed what this found.** The audit that preceded it searched for `game.actors` with
an unescaped dot, which cannot match `game?.actors`, and concluded the module enumerated nothing. It
enumerates in `FoundryActions.openCharacterSheet`, which is allowlisted because it is already correct:
it filters to `isOwner === true` immediately and opens a sheet only when exactly one survives.

⚠️ **Its first run reported the right finding at the wrong line**: 98, where the truth was 143,
because deleting block comments removes their newlines and shifts everything after. Comments are
blanked in place now, and the self-test pins that. A wrong line number is worse than none: it sends
the reader to an unrelated function and makes a true finding look false.
