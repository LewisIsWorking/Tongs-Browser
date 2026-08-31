---
'tongs-browser': patch
---

Test a two finger pan all the way from touch to `canvas.pan`.

The four canvas thunks in `ModuleParts` were never called by any test. They are the last link in the
pan chain, and the controller they feed records a measured failure on a live 14.365 where a +120,+120
drag put the pivot at (-1940, -980), with the warning that "leaving either conversion out breaks it
in a way that still looks plausible".

Both conversions are now asserted through a real touch sequence: panning relative to the pivot rather
than the origin, and dividing the screen delta by the live scale, the latter by comparing two runs so
that half the scale must move the pivot twice as far. Dropping either conversion, or nulling either
thunk, fails.

`ModuleParts` goes 77.27% to 86.36% of functions; project coverage to 97.15 statements, 96.14
functions.
