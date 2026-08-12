---
'tongs-browser': patch
---

Extract finding "my character" into `foundry/CharacterSheet.ts`, at 100% coverage.

The order is the whole content of this, and each step earns its place: the assigned character,
because that is what the user explicitly nominated; then a controlled token's actor, because on a
phone selecting a token and then asking for its sheet is the natural flow and double tapping a token
accurately is fiddly, which is the problem this module exists for; then the only actor they own.

The test worth having guards the last step:

> **Exactly one owned actor, never a guess between several.** A wrong sheet is worse than no sheet:
> it looks like the button worked, so the user acts on the wrong character rather than trying again.

Failure is reported rather than silent, so the caller can say what would fix it. Deliberately system
agnostic: PF2e and SF2e were the worlds this was asked for, but every system renders through the same
`Actor#sheet`, and naming one would only make it break on the next.

`TongsBrowser.ts` is down from 1,853 to 1,315, with eleven new modules all under 200 lines and all at
100% on statements, branches, functions and lines.
