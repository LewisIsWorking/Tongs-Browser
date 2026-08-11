---
'tongs-browser': patch
---

`npm run check:drag -- --android` runs the token drag assertions against Chrome on the real device.

Desktop passes and the same gesture fails on a phone, so desktop can no longer answer the question,
and inferring the difference from pasted reports has cost three releases. This runs the identical
assertions over the DevTools socket `adb` forwards.

Two things it does differently there, both of which would otherwise make the harness blame the
module:

- The drag is a **third of the viewport** rather than a flat 240px. The hit tester clamps the pointer
  inside the viewport, so a 240px drag across a 360px phone runs into the edge, moves the token less
  than asked, and reports "the drag is not following the pointer" about the harness's own arithmetic.
- It **does not close the browser** on the way out. That is the user's own Chrome with their own tabs
  in it, and a diagnostic that tidies up by closing your browser is not a good trade.
