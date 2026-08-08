---
'tongs-browser': minor
---

Add client settings and a scene control toggle.

All eleven settings from the design are registered as client scope, so each player configures their
own device, and every one applies live rather than needing a reload. Values are validated and
clamped on read rather than cast, so a setting written by an older version or edited by hand cannot
reach the gesture config as a NaN.

The scene control button matters more than convenience suggests: if the pointer misbehaves mid
session, reaching the settings dialog to disable it means using the pointer to do so.

Also adds the debug overlay, which outlines the element the pointer currently resolves to and logs
every synthesised event.
