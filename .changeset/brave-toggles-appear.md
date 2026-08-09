---
'tongs-browser': patch
---

Make the scene control toggle exist, and be reachable.

The one control that has to work when the pointer is misbehaving did not exist at all on Foundry 14,
for two independent reasons. The `getSceneControlButtons` hook was bound at `ready`, but Foundry
builds the scene controls exactly once before that, so the listener fired zero times even after a
forced re-render; it now binds at `init`. And the group is called `tokens` on v14 while the code
looked for `token`, with a fallback that would have put the button silently into `regions`, which is
worse than not appearing. The fallback is gone: it returns null rather than guessing.

With the toggle finally rendering, the module's own modifier bar covered it. The scene control
toolbar occupies x 12 to 66, and the bar defaulted to x 16, so the toggle at x 42 to 66 sat entirely
underneath it and `elementFromPoint` returned the bar's collapse button. The default moved to x 88.

Also adds `.chat-log` to the exclusion zones. `#chat-log` matched nothing on 14.365, since the log is
a class there and the id is v12 markup; the behaviour had survived only because `.chat-scroll` wraps
it. ADR 0008.
