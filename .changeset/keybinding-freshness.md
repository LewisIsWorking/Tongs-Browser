---
'tongs-browser': patch
---

Catch the keybinding snapshot going stale, instead of trusting it.

The coverage guard compares our routing table against our snapshot. Both are ours, so the strongest
thing it can prove is that we agree with ourselves. On a machine running Foundry 14.367 it printed:

    OK: all 37 core keybinding(s) from Foundry 14.366 are accounted for.

Green, and useless. Four bindings were unaccounted for, and one key had changed hands.

**What 14.367 actually changed**, read from its own registration file:

- `ascend` is new, on `KeyE`
- `moveDownRight` HELD `KeyE` at 14.366 and is now registered with no default key at all
- `moveUpLeft`, `moveUpRight`, `moveDownLeft` are new, and all four diagonals ship unbound

A key that changes hands is worse than one that disappears. Every name was still present, every
count still plausible, and the routing decision about `KeyE` kept reading sensibly while pointing at
a different capability. The snapshot is re-taken at 14.367 and the four new bindings are routed; the
diagonals are gaps that say they are unbound in core, because giving a phone a control the desktop
does not have by default is not what this module is for.

**The freshness rule was a habit, not a gate**, and `npm run check:keybindings:live` replaces it. It
joins a running world, reads `game.keybindings.actions`, and compares that to the snapshot: bindings
Foundry has that we do not, bindings we have that it does not, and keys that moved. It is separate
from the CI guard on purpose, because that one must run where no Foundry exists, and it fails rather
than skips when it cannot find one.

It earned its keep immediately, in both directions. It found that `delete` is `Delete` uneditable
PLUS `Backspace` editable, and the snapshot had only ever recorded the first. It also found three
bugs in itself on its first run: reading `editable` while ignoring `uneditable` reported six
Ctrl-chords and Escape as "(unbound)"; ignoring modifiers would have called `Ctrl+C` and plain `C`
the same binding; and Foundry's fifteen looped registrations (`executeMacro0`..`9`,
`swapMacroPage1`..`5`) were reported as new on every run, which would have buried the one real
finding under them. A check that always fails is a check nobody reads.

Also: the snapshot claimed `docs/MANUAL-TESTING.md` told you to re-take it on a version bump. That
document says no such thing, so the freshness rule was a cross-reference to advice that did not
exist. The claim is replaced by the command that now does the work.
