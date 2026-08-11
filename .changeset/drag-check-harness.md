---
'tongs-browser': patch
---

Add `npm run check:drag`, which asserts that a token **moved**, against a live Foundry.

Every existing drag test asserts on the event stream: that a move carried `buttons=1`, that the
captured target was reused, that the right descriptors were emitted. All of it stayed green through
three releases a real phone reported as broken, and none of it is what a drag is. jsdom makes that
unavoidable rather than merely tempting, since there is no PIXI, no hit testing and no token there to
assert on.

This drives the module's own pointer through grab, move and drop and passes only if
`token.document.x` ends up roughly where the pointer went. Three of its safeguards exist because the
check accused the module of a bug that was in the check:

- It waits for the position to **settle**, not to change. Foundry animates a token along its movement
  path, so the first changed value reads the token mid flight: a 240px drag measured as 17.64px.
- It **pans to the token** before pressing. Without that it pressed at (-375, -325), hit nothing, and
  reported "the token did not move", which is true and accuses code that never ran.
- It **refuses to give a verdict** it cannot support: a press point that is not over `canvas#board` is
  a hard error rather than a failure.

It also traces our pointer, Foundry's drag destination and the drag clone at every step, so a failure
says which pair disagrees. ADR 0011.
