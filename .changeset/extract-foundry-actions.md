---
'tongs-browser': patch
---

Extract what the tray buttons do to Foundry into `foundry/FoundryActions.ts`.
**`TongsBrowser.ts` drops from 593 to 422.** 742 tests green.

Every decision here already lives in a module of its own, tested: `PauseControl`, `SidebarAccess`,
`CharacterSheet`. This is the layer that reaches for the globals and carries those decisions out, and
keeping it apart from the composition root means the root wires things together and nothing else.

It also puts the reaching-for-globals in **one place** rather than scattered through a class that
also builds a pointer, a gesture layer and a modifier bar.

Two things worth keeping visible, now that they sit beside the code they explain:

- **The sidebar picker is 44px rows in an element this module owns.** Foundry's own tab strip is 27px
  wide on a phone, which is what made the sidebar unreachable in the first place, so reusing it to
  choose a tab would inherit exactly the problem being solved.
- **A macro cannot let a player pause the WORLD.** Foundry's `Game#togglePause` only emits its socket
  message `if (options.broadcast && game.user.isGM)`, so a player running any macro toggles their own
  client and nobody else's. The check is on the EMIT path, not on macro permissions, which is why
  granting ownership looks like it should solve it and does not.
