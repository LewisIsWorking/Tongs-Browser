# keybindings

## Purpose

What Foundry can do from a keyboard, and how a phone reaches each of it. Backs
`npm run check:keybindings`.

| File          | What it is                                                                 |
| ------------- | -------------------------------------------------------------------------- |
| `snapshot.ts` | Every keybinding core Foundry registers, measured from 14.366's own source |
| `coverage.ts` | How each one is reached: the bar, the control pad, Foundry's UI, or not    |
| `parse.ts`    | Reads the module's own key codes and tray ids out of its source            |

## Why it exists

The target key was found by hand. Somebody listed Foundry's keybindings, compared them against the
eight on the modifier bar, and noticed that the key deciding **who an attack is against** was one a
phone could not press. That is a good outcome reached by luck: nothing recorded what was reachable,
so nothing recorded what was missing either.

This turns that comparison into a lookup, and into something that fails. A Foundry upgrade adding a
keybinding now has to be classified rather than quietly ignored, and a route naming a bar key or a
tray button that no longer exists is an error rather than a stale sentence.

## The four routes, and why they are not one

`bar`, `tray`, `ui` and `gap` are kept apart because collapsing them destroys the answer. A binding
on the modifier bar and one reachable by tapping Foundry's own control are both "reachable", but only
the first is this module's doing, and only the second breaks when Foundry rearranges its interface. A
`gap` is neither, and each one has to say what a user cannot do, so the cost is written down rather
than implied by absence.

## Keeping the snapshot honest

⚠️ It is a **snapshot**, not a live read. The guard has to run in CI, where there is no Foundry
installed, and a check that silently skips is not a check. The cost is that it goes stale on a
version bump, so the version it was taken from is printed on every run.

To re-take it, read the `game.keybindings.register("core", ...)` calls out of
`client/helpers/interaction/client-keybindings.mjs` in the installed Foundry. Read the registrations
themselves rather than the settings UI: that file is the registration and cannot disagree with
itself.
