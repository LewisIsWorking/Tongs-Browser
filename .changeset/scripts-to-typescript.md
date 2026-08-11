---
'tongs-browser': patch
---

The tooling scripts are TypeScript. They were `.mjs` and outside the typed program entirely, so 3,795
lines of harness that drives a live Foundry had no checking at all.

Node 26 runs TypeScript directly by stripping types, so this needs no bundler, no `tsx` and no new
dependency: `node scripts/foundry-drag-check.ts` simply works, and the npm scripts and the release
workflow point at `.ts` now.

`scripts/foundry-globals.d.ts` declares Foundry's in-page globals, which removed 280 of the 591
errors the rename exposed. They are typed as `any` on purpose. Foundry ships no types, and a hand
written partial interface would be wrong in a specific and dangerous way: authoritative-looking,
describing whatever subset somebody needed on the day, and drifting with every Foundry release. An
honest `any` says "unchecked" out loud where a half accurate interface would claim otherwise.

`npm run typecheck:scripts` checks them against `tsconfig.scripts.json`, which relaxes exactly two of
the app's rules, `noPropertyAccessFromIndexSignature` and `exactOptionalPropertyTypes`. Both fire on
every `process.env.FOO` and on optional fields handed to Playwright, and neither describes a defect in
a script. `strict` still applies.

**293 type errors remain**, all in harness files that predate this change, almost all missing
annotations on Playwright callbacks. They are reported rather than hidden, and `typecheck:scripts` is
deliberately not yet part of `verify`, because wiring a red check into the gate would only teach
everyone to ignore it. Type aware lint rules are also still off for `scripts/**`: turning them on
produces 1,895 findings, which is a migration of its own rather than something to bundle in here.
