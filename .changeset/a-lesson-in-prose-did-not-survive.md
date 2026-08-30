---
'tongs-browser': patch
---

`check:support` could not see a fixture that had just been written, and now no guard can regress that
way unnoticed.

`git ls-files` reports tracked files only, so a file created moments ago is invisible until staged.
That is exactly the case this guard exists for: the moment somebody is most likely to extract a
fixture and forget to adopt it is the moment they have just written it. Demonstrated before fixing,
an unadopted fixture sitting in `tests/dom/support/` produced "All 9 shared test fixture(s) are
imported somewhere".

The blind spot was found in `check:sizes` on 2026-08-18 and fixed in two guards, and the lesson was
written down as "a blind spot found in one guard is worth looking for in every guard that shares the
technique". It was not acted on, and `check:support` still had it four days later. A lesson recorded
in prose did not survive, so it is now a test: every guard must be able to see an unstaged file, and
one that calls `git ls-files` directly has to ask for `--others --exclude-standard`.

⚠️ That test failed on its first run against two guards which only MENTION `ls-files` in a comment
about this very blind spot. A comment is not a caller, which is also already written down. It strips
comments first now.
