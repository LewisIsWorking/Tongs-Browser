---
'tongs-browser': patch
---

Extract the Foundry drag observers out of the composition root, at 100% coverage.

`TongsBrowser.ts` had reached 1,853 lines against a hard 200 line limit, and these observers are the
one part of the diagnostics with real logic rather than formatting in them. They now live in
`debug/FoundryDragHooks.ts`, which is 151 lines and covered on all four metrics.

Two properties are asserted that were previously untestable, and both are load bearing because this
code runs inside somebody's live game:

- **The wraps do not change anything.** Each calls the original with the original `this` and returns
  its result untouched. A probe that alters what it measures is worse than no probe.
- **They survive a Foundry that is not ready.** The canvas does not exist when the module is built,
  and the interaction manager prototype is only reachable through a live token, so "hook the token
  but not the manager yet" is a real state rather than a defensive branch nobody expected.

`TongsBrowser.ts` is down to 1,746. Still far over, and the remaining diagnostics need splitting
across three or four files rather than moving wholesale.
