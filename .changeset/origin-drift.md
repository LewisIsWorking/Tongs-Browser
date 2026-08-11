---
'tongs-browser': patch
---

Measure whether Foundry's drag origin is following the pointer, and reproduce phone input on desktop.

A device's numbers now say what the bug is, by arithmetic: the pointer travelled 139.4px, PIXI's
pointer was 0.0px from ours, and Foundry's gate `|pixi - screenOrigin|` was 0.0px. All three can only
hold if **`screenOrigin` travelled 139.4px too**. An origin that follows the pointer can never be
10px away from it, which is why that device sits at `GRABBED (3)` forever, never reaches `DRAG (4)`,
creates no preview and moves no token.

The report now measures that drift directly rather than leaving it to a three step inference, since
this investigation has already had two confident inferences turn out wrong.

What it is **not**, each ruled out by measurement rather than argument:

- Not PIXI failing to receive synthesised events on a touch device. `ours vs PIXI` measured 0.0px.
- Not `screenOrigin` aliasing PIXI's live pointer object. Measured `false`.
- Not touch input, a mobile user agent, or a device pixel ratio of 3. `check:drag --mobile` turns all
  three on and passes, with `screenOrigin` pinned at 683 across twelve steps.
- Not the pointer failing to travel far enough. 139.4px against a 10px threshold.

`--mobile` deliberately does not shrink the viewport to the phone's 360x607, because **Foundry itself
refuses to run below 1024x768** and replaces the interface with a paragraph saying so. The press point
guard caught that immediately and quoted it, which is the second time that guard has stopped the
harness blaming the module. The drag check now quotes the text of whatever is in the way, not just
its tag name.
