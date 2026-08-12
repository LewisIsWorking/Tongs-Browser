---
'tongs-browser': patch
---

Harness type errors 293 down to 132, with three files at zero.

`foundry-session.ts`, `foundry-touch.ts` and `foundry-drag-check.ts` now typecheck clean. The first
two are the shared modules everything else imports, so typing them stops the `any` at the boundary
rather than letting it spread to every caller.

Two findings worth keeping out of this:

**Playwright's `Page` and the CDP stand in are genuinely incompatible types**, not one type wearing
two hats. Playwright's `evaluate` carries generic overloads nothing hand written can satisfy, so a
"common interface" for them cannot exist. The union is kept honest instead, with one documented
adapter for evaluation and narrowing at exactly the two places a Playwright only method is required.
That is more truthful than a shared interface that quietly lies about what either surface is.

**`passed: null` is a SKIP and deliberately not a boolean.** Now that the check result shape has a
name, that distinction is in the type rather than in a convention, so a skip cannot be filtered or
read as a pass.

Verified nothing broke: `foundry-drag-check` still PASSES against a live Foundry, moving a token
(600, 600) to (800, 600).
