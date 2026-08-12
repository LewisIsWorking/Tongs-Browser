---
'tongs-browser': patch
---

Type the harness properly: 293 script type errors down to 178, with `foundry-session.ts` at zero.

Renaming `.mjs` to `.ts` was the easy part and left 3,795 lines of TypeScript that did not typecheck,
which is the worst of both: the syntax without any of the guarantees. This is the start of paying
that off, working from the shared module outward.

- `foundry-session.ts`, which every check imports, is now **fully typed and error free**. Its entry
  points take Playwright's real `Page` rather than an implicit `any`, so the annotation propagates to
  every caller instead of stopping at the boundary.
- The Foundry globals are declared with `var` rather than `const`, and the difference is the point: a
  `var` in a global script becomes a property of `globalThis`, so both `canvas` and `globalThis.canvas`
  typecheck. Harness code reaches them both ways, the bare form inside `page.evaluate` and the
  `globalThis.game?.ready` form in code that has to survive Foundry not being loaded yet.
- The check harnesses share one result shape, now named. `passed: null` is a SKIP and is deliberately
  not a boolean, so a skip cannot be mistaken for a pass by a reader or by a filter.

Verified the conversion did not break anything that matters: `check-em-dashes` runs clean and
`foundry-drag-check` still PASSES against a live Foundry.
