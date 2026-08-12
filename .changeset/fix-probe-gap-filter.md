---
'tongs-browser': patch
---

Fix the capability probe reporting an **unmeasured** run as a confirmed gap, and extract its
reporting into `scripts/probe/Report.ts` at 100% coverage.

The filter read `!pointerTrials.some(o => o === 'yes')`, which is "not a yes" rather than "a no". A
trial can also be **`AIM`**, meaning the pointer never REACHED the target, so nothing about the
capability was measured at all. A run of pure aim failures therefore passed the filter and was
reported as:

> `N capability gap(s): the pointer failed every trial and a native control succeeded in every trial.`

That sentence was untrue, and it is the line the exit code is set from. It would have sent somebody
to fix a capability that had never been exercised.

⚠️ **`verdict` already made exactly this distinction** and had a comment explaining why: "a run that
never reached its target is not a flaky capability, it is an unmeasured one." The two functions
disagreed about the same three-valued outcome, in the same file, one of them documented. Extracting
them side by side is what made it visible.

Also fixed while writing the tests: `every` is vacuously true on an empty run, so a capability with
no trials at all would have been reported as a proven gap.

`foundry-play-probe.ts` drops from 650 to 571. ⚠️ The rest of that file is a single `page.evaluate`
body, which cannot be split by extraction: Playwright serialises only the function's own source, so
an imported helper does not exist in the page. Splitting it properly means installing the harness
helpers with `addInitScript` first, which needs a live Foundry to verify and is not something a
typecheck can stand in for.
