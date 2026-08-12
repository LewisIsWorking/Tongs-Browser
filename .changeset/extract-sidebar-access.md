---
'tongs-browser': patch
---

Extract reaching Foundry's sidebar into `foundry/SidebarAccess.ts`, at 100% coverage.

This is a real feature area rather than a tidy up. Foundry auto collapses its sidebar below about
1024px into a strip of icons hard against the right edge, and its expander is a few pixels wide,
which is not a realistic touch target. A device reported "no side bar" three separate times while the
module was otherwise working, so the answer is to pop tabs OUT as windows rather than fight the
collapsed strip: a popped out chat or actors tab is a normal Foundry window, movable and closable
with gestures the module already provides.

Three behaviours now have tests, and each one exists because of a way this can fail quietly:

- **A tab whose application cannot pop out is not offered.** A button that quietly does nothing is
  worse than a shorter list: the user taps it, nothing happens, and concludes the module is broken
  rather than that the tab is unavailable.
- **Popping out TOGGLES.** That button is the only way back, and an open chat window with no way to
  dismiss it would cover the map on a phone, which is the problem this solves rather than a new one.
- **Failing to expand reports failure**, so the caller falls back to the tab picker instead of
  leaving the user tapping a dead control.

Everything reads Foundry through an injected accessor rather than `globalThis`, which is what makes
it testable: being reachable only from the composition root is exactly what made these untestable.

`TongsBrowser.ts` is down from 1,853 to 1,436.
