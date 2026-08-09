---
'tongs-browser': patch
---

Verify both Foundry interaction surfaces accept the virtual pointer.

`npm run check:foundry` drives a real Foundry and asserts against Foundry's own state rather than
against appearances: a synthesised click is judged by `ui.sidebar.tabGroups`, and a synthesised
pointer move by `canvas.mousePosition`. Both pass on 14.365, which measures the central risk ADR 0003
was written to manage. Recorded in ADR 0005.

The session handling shared by both Foundry tools is extracted into `scripts/foundry-session.mjs`,
since a second copy of a login is a second thing to get subtly wrong in a way that hangs rather than
errors.
