---
'tongs-browser': patch
---

Harness type errors 293 down to 119, and the type checker found real null holes.

`foundry-session.ts`, `foundry-touch.ts`, `foundry-drag-check.ts` and `foundry-probe.ts` typecheck
clean; `foundry-live-check.ts` has one error left.

The findings were not annotation noise. Three DOM queries in the live check were used without a null
check, so a missing element produced a bare `TypeError` from the following line and told nobody what
was actually absent. Each now says which thing was not there:

- `no .tb-cursor in the document: the module has not drawn its pointer.`
- `no #board in the document: Foundry has not drawn its canvas.`
- `no [data-tool="tongs-browser"] control: the scene control was never created.`

Every one of those is a real outcome this harness is meant to detect rather than crash on, and ADR
0010 is about exactly this: a check that cannot say whose fault a failure is teaches you to distrust
it. Also fixed a `record(..., moved.reason)` where the reason is optional and only the failing branch
sets it, so a missing one would have printed `undefined` into a result line.

Verified by running it: `foundry-live-check` still passes every assertion against a live Foundry, so
the typing changed nothing at runtime.
