---
'tongs-browser': patch
---

The play probe's native control could not select a token, and nothing could have noticed.

The control is what decides whether a pointer failure reads as "the module is broken" or "cannot
tell". It only runs when a pointer path is unreliable, so with every pointer path passing it had not
executed in months. Exercised by hand it failed outright: it pressed with Foundry's interaction
manager still at `NONE`, because it never moved the pointer first, and
`MouseInteractionManager#handleLeftDown` returns unless the state is at least `HOVER`.

A broken control turns every real regression into `inconclusive`. The safety net had a hole in exactly
the place it would be needed.

Measured by bisection on a live 14.366: click alone leaves state 0 and selects nothing; one plain
`pointermove` first takes state to 1 and selects. `pressure`, `width`, `height` and a reserved
`pointerId` make no difference, though they were the obvious suspects.

`PROBE_FORCE_CONTROL=1` now runs both paths every time, so the control is observable on demand rather
than only in the moment it is being relied upon. Using it immediately exposed a second defect:
`describeControl` announced `reliable -> OUR GAP` from the control alone, assuming a control had only
run because the pointer failed, so five rows with a working pointer and a working control were all
labelled our gap. `findGaps` checks both halves and was always right, so the exit code never lied.

A test had been pinning that behaviour: its name said "the pointer was not reliable" while it handed
over three passing pointer trials.
