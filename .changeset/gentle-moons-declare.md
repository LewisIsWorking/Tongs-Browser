---
'tongs-browser': patch
---

Declare compatibility with Foundry 14.366.

`compatibility.maximum` was already `14`, so the module loaded on 14.366 regardless; this updates
`verified` so the package browser stops offering it as an untested pairing.

Nothing in the module's own surface is touched by that release. The changes are to package
installation, the Windows installer location and the world login page, none of which the module
reaches into. The README now separates the declared version from the measured one, because every
`14.365` reference elsewhere in this repo is a dated measurement and rewriting those would falsify
the record.
