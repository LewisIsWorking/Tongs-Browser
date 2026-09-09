---
'tongs-browser': minor
---

Give a GM the six map-building commands a phone could not reach.

`selectAll`, `cut`, `copy`, `paste`, `sendToBack` and `bringToFront` were the last real gaps in the
keybinding coverage table. Each is now a button in a gated `map` cluster on the control pad, so the
control pad goes from 8 of Foundry's keybindings to 14 and the unreachable count from 19 to 13.

The nineteen were never nineteen missing features. Most were honest non-gaps already written down as
such: the diagonal pans compose from the straight ones, token movement is what dragging is for,
push-to-talk is audio this module does not touch. These six were the residue a user genuinely could
not do at all, and they share one description: a GM building a map on a phone could not select, cut,
copy, paste or restack anything.

**Four are chords and two are not, which is the part worth knowing.** Foundry binds selectAll, cut,
copy and paste to Ctrl+A/X/C/V, but sendToBack and bringToFront to the BARE bracket keys. The six are
alike in what they are for, which is exactly what invites the assumption that they are alike in how
they are sent. A Ctrl-wrapped bracket is a chord Foundry does not bind, so those two buttons would
have looked identical to the four beside them and done nothing whatsoever. The key codes come from
the snapshot taken from Foundry 14.366's own registration file, not from memory, and the tests assert
the full ordered key sequence rather than merely that a key was tapped, because an assertion that
only checked the tap would pass while the command was dead.

They are absent for a player rather than disabled, on their own gate. Foundry refuses these
operations to anyone who is not a GM, so unlike the create button there is no player version of this
to grow into: a control offered to a player could only ever be silence, and silence on a phone reads
as a broken module because there is no console to check which it was.

Also fixes the keybinding coverage guard, which read tray button ids from one file and so reported
all six as missing the moment they were extracted to a second one to stay under the size limit. It
now reads a named list of button sources. That direction of the bug was the harmless one; the
dangerous version is a button file nobody lists, whose absence then reads as "not built yet".
