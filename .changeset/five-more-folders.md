---
'tongs-browser': patch
---

Five more folders documented: `src/foundry`, `src/core`, `scripts/touch`, `scripts/live`,
`scripts/android`. Fifteen of twenty-six now carry a README that names its own files.

Each records why the folder is shaped as it is: why the Foundry dependency surface is a folder rather
than scattered `game.` references, why the long press guard must be armed after the sequence rather
than before, why the touch checks and the drag check deliberately cover different halves, why the
scene control is asserted as registered, rendered and reachable separately, and why the device path
is a different surface rather than a smaller one.
