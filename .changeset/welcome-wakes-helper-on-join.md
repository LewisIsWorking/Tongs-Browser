---
'tongs-browser': patch
---

A player whose character request is still waiting now calls ComeOnOverUno's helper GM again when they come back to the world, so the sheet is made without a GM online. Before, the helper was called only at the moment of asking, and if that one call was turned away the request waited until a GM happened to join. It is one call per visit, never on a timer, and none while a GM is online.
