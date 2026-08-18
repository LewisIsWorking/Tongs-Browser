---
'tongs-browser': patch
---

Every folder holding source has to say what it is for, and boilerplate does not count.

`check:readmes` requires each source folder to carry a README that **names at least one file that
genuinely lives in it**. Existence alone was deliberately not the rule: a guard that checks only for
the file asks twenty-six folders for one and gets twenty-six files saying "This folder contains
helpers", after which the check is green forever and nobody has learned anything. Naming a file is
cheap to satisfy honestly and impossible to satisfy with boilerplate, because the filenames differ per
folder.

Proved by feeding it the bug: a filler README replacing `scripts/probe`'s is rejected by name, and the
same rule is covered by unit tests and by a self test wired into the command so it actually runs.

Folders not yet documented sit in a backlog that can only shrink, the same discipline as the file size
ratchet and for the same reason: the rule arrived long after the code, and demanding twenty-five
READMEs in one commit is how filler gets written. Six of twenty-six are done, starting with the ones
whose lessons were expensive: `scripts/foundry`, `scripts/probe`, `scripts/sizes`, `scripts/readmes`,
`scripts/drag` and `src/gesture`.

Seeding it found a bug in the guard itself. A root level file has no `/`, and `slice(0, -1)` shaves a
character off rather than returning an empty string, so the first backlog listed three folders named
`playwright.config.t`, `vite.config.t` and `vitest.config.t`.
