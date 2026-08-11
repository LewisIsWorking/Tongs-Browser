---
'tongs-browser': minor
---

Fix panning, which never worked, and add navigation buttons to the bar.

**Panning was broken from the start.** `CanvasController.panBy` passed its screen space delta
straight into `canvas.pan({x, y})`, but Foundry's pan is ABSOLUTE: it sets where the viewport is
centred, in scene coordinates. So a 50px drag did not pan by 50px, it teleported the view to scene
coordinate -50. Measured on a live 14.365 with a 4000x3000 scene, a two finger drag of +120,+120 put
the pivot at (-1940, -980). The delta is also in screen pixels while the pivot is in scene units, so
it now divides by the live scale as well: without that, panning is correct at 1x and wrong at every
other zoom, and a phone almost never sits at 1x.

Two guards let it through and both are fixed. The unit test asserted the wrong answer as a
requirement, and the fake canvas recorded pan calls without applying x or y so it could not express
the bug. The live check asserted only that the pivot moved NEGATIVELY, which the bug satisfies
perfectly; it now asserts the magnitude the geometry requires.

**New buttons on the bar**, all reachable with a thumb at the 44px minimum: pan arrows, zoom in and
out, a character sheet button, and the sidebar toggle. The arrows and zoom buttons exist because a
two finger gesture that half works is worse than a button, since you cannot tell whether you did it
wrong. The pan step is in screen pixels, so the map moves the same visible distance at every zoom.

The character sheet button tries the assigned character, then a controlled token, then the only
actor you own. It is system agnostic rather than PF2e specific, because every system renders through
the same `Actor#sheet`.
