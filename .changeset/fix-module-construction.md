---
'tongs-browser': patch
---

**Fix the module failing to start.** `new TongsBrowser(...)` threw on Foundry's `ready` hook, so no
cursor and no modifier bar ever appeared. The scene control button still showed, because it is
registered on `init`, which is why the module looked present and did nothing.

`ModuleParts` reached BACK through the module for parts the factory had not returned yet. The bar was
the trigger: `new ModifierBar(...)` calls `refreshActions()` at the end of its constructor, the grab
button is asked whether a drag is in progress, and the pointer it asked was still `undefined`.

The factory holds every one of those as a local. It now uses them directly, and `ModuleSelf` is down
to the single thing only the module knows: whether it is enabled.

⚠️ **This shipped because I merged thirty refactoring PRs on unit tests alone.** Every focused suite
stayed green while the composition root could not be constructed, which is exactly what
`PreMergeTestingPolicy` exists to prevent and exactly the gap it names.

`tests/dom/moduleConstruction.test.ts` is the missing test, and it reproduced the failure in one run:
it builds the module with the options `main.ts` passes, enables it, and taps **every** tray button.
Nothing in it asserts behaviour a focused suite does not already own. What it asserts is that the
pieces go together at all.

`eventView` becomes an option, threaded the same way `PointerStack` already threads it, so a suite
that constructs the whole module can omit it: vitest's jsdom window is not a branded `Window` and
`new PointerEvent({ view })` rejects it.
