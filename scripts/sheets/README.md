# scripts/sheets

The live checks behind `npm run check:sheets`.

| File             | What it checks                                                         |
| ---------------- | ---------------------------------------------------------------------- |
| `sheetChecks.ts` | The two new tray buttons exist, are reachable, and say the right thing |

## Why a browser, when the unit tests pass

Every failure this catches compiles, type-checks and passes the whole suite:

- a button in the tray list that a gate filters out because it reads a global wrongly
- a picker appended to a host that does not exist on a real page
- a flow that throws inside a click handler, into a console a phone user cannot open
- a notice whose text is right in the fixture and never reaches the DOM

That last one is the reason the checks assert **text** rather than "a picker appeared". An empty box
satisfies "something opened", and the entire value of these two notices is that they say _different_
things: "there is no party" invites making one, "you may not create here" tells a player to ask their
GM. A check that only counted elements would pass with either message in either place.

## ⚠️ What it does not cover

**The party path.** `party` is a PF2e actor type, and the world available on this machine runs `coo`,
so there is no party to open and none to create in. Covering it needs a PF2e or sf2e world, which is
a change to somebody's Foundry install rather than something a harness should make for itself.

What remains is still worth running: "no parties yet" is the state every real user meets first, and
the buttons existing and being reachable is exactly what a passing build cannot promise.

## It writes nothing

Unlike the other live harnesses there is no probe scene and no probe actor, because everything
asserted is about the tray and its notices. Nothing needs cleaning up after a crash.
