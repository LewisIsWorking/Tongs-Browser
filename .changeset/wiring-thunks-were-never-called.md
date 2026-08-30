---
'tongs-browser': patch
---

Test the wiring thunks in `buildModuleParts`, which nothing called.

`ModuleParts`' own docblock says every reference a part takes back to the module is a thunk, and that
taking one eagerly captures `undefined` and fails at the first tap. Seven of those thunks were never
invoked by any test, so the claim was documented and unverified.

The new suite exercises the binder's fan-out to both the diagnostics counter and the gesture layer,
the pointer stack's dispatch fan-out to both recorders, and the default native-touch suppression that
every other test overrides. Mutation checked: dropping each of the three wires kills a test.

Coverage of `ModuleParts` goes 68.18% to 77.27% of functions, and the project ratchet tightens to
96.12/94.03/93.57/96.08.
