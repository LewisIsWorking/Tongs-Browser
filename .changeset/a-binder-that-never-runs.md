---
'tongs-browser': patch
---

Test that the window clamp binder actually binds.

The existing suite covers `clampAll` thoroughly and calls it by hand every time. In a real session
nothing does: Foundry renders a window and the render hook is the only thing that notices. The
clamping was covered and the binding was not, and a binder that clamps perfectly but never runs is
indistinguishable from no binder at all.

Asserts registration for both application generations, clamping of what is already on screen and of
what renders later, the double-bind guard, and that unbinding leaves it able to bind again. Mutation
checked: all six mutations kill a test.

The two window helpers moved into a shared fixture rather than being copied, since the jsdom layout
workaround they carry is load bearing.
