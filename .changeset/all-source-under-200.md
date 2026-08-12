---
'tongs-browser': patch
---

**Every file in `src/` is now under 200 lines.** `TongsBrowser.ts` finishes at 197, from 1,853 this
morning. 750 tests green.

The last four extractions:

- **`ModuleParts`** builds every part the module is made of. ⚠️ Every reference a part takes BACK to
  the module is a **thunk**, and that is what makes one builder possible at all: the parts are built
  in an order, and several need a sibling that does not exist yet. The tray needs the pointer while
  the bar is still being constructed, the relay needs the actions, the binder needs the gestures.
  Taken eagerly, each captures `undefined` and fails at the first tap, long after the code that
  caused it has finished running. That is the third instance of this shape today.
- **`TongsBrowserOptions`** becomes the contract, so `ModuleParts` can name it without importing the
  class it builds.
- **`Vibrate`** is feature detected at the CALL SITE rather than trusted from the type: `lib.dom`
  declares `navigator.vibrate` as always present, it is absent on iOS entirely, and on Android it is
  silently ignored until the page has been interacted with, so a haptic that never fires is
  indistinguishable from one that fired and was not felt.
- **`SidebarMenu`** builds the picker from our own rows rather than Foundry's tab strip, which is
  27px wide on a phone. Reusing that strip to CHOOSE a tab would inherit exactly the problem being
  solved.

Both new modules are at 100%, as is everything extracted today.
