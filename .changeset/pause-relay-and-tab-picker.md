---
'tongs-browser': minor
---

Let players pause the game, and reach every sidebar tab rather than just chat.

**Players can pause.** Foundry's `Game#togglePause` only broadcasts
`if (options.broadcast && game.user.isGM)`, so the permission check sits on the emit path and a
player calling it toggles their own client alone. Macro ownership does not help either: `Macro#execute`
runs the script client side as whoever pressed it, and core Foundry has **no** execute-as-GM at all,
verified against the installed 14.365 where `executeAsGM`, `execute-as` and `asGM` appear nowhere in
client or common. That feature comes from modules such as Advanced Macros.

So a player now emits a request and one GM performs the toggle. The GM is chosen with Foundry's own
`game.users.activeGM`, which picks the same single user on every client: without that, every
connected GM would answer the same request and the pause state would flip once per GM. The request
carries the desired state rather than the word "toggle", so two players tapping at once agree on an
outcome instead of cancelling each other.

**Every sidebar tab, not just the active one.** The sidebar button popped out whichever tab was
active, which meant chat and nothing else, because the only way to change tabs is the docked strip
that is 27px wide on a phone. It now opens a picker listing all thirteen tabs, built from our own DOM
at 44px a row, and drops gmOnly tabs for players so nobody is offered a Scenes tab that would refuse
to open.

Measured on real Android at 412x783: the picker renders fully on screen, the Actors row is reachable
by hit test, and picking it renders the Actors popout on screen.
