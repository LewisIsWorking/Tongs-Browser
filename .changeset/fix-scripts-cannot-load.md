---
'tongs-browser': patch
---

**Fix six harness checks that could not be loaded at all**, and add `check:scripts` so a green
typecheck can never mean that again.

Found by trying to run the drag check rather than reasoning about it. Two separate failures, both
invisible to `tsc`:

⚠️ **27 import specifiers ended `.js`.** These scripts run through Node's type stripping, which
resolves the REAL file, so a specifier must end `.ts`. TypeScript maps `./Thing.js` back to
`./Thing.ts` and says nothing; Node then cannot find `./Thing.js`, because no such file exists.
Splitting one harness into seven modules introduced all 27 in a single commit, and
`typecheck:scripts` reported zero errors on every one.

⚠️ **`foundry-touch.ts` used parameter properties.** Node STRIPS types rather than compiling them, so
anything that emits code is rejected outright and the whole file fails with
`ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`. A parameter property is ordinary TypeScript and `tsc` is
perfectly happy with it. The touch, multitouch and Android checks have not been runnable since the
scripts were converted from `.mjs`.

The guard checks both, statically. It deliberately does **not** import anything: importing runs the
script, and these launch browsers and write to a live world. It uses `module.stripTypeScriptTypes`,
which is the exact transform Node applies, and resolves the specifiers itself.

Two things it got wrong first, both now recorded beside the code:

- **A guard that contains EXAMPLES of what it detects will detect itself.** Its self test samples are
  string literals holding `'./b.js'` and a parameter property, so it flagged its own source. It skips
  its own file; the self test covers it instead, which is the better guarantee anyway.
- **A negative case has to be negative for EVERY check.** The "sound file" sample imported a made up
  path, so the existence check fired and the self test failed for the right reason on the wrong input.
