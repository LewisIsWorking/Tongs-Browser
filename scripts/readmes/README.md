# scripts/readmes

Every folder holding source says what it is for, checked rather than hoped for.

| File       | What it is                                                   |
| ---------- | ------------------------------------------------------------ |
| `rules.ts` | What counts as documented, plus the self test that proves it |

The command line lives in `scripts/check-folder-readmes.ts`. Same split as `scripts/sizes`, for the
same reason: the rules can then be exercised against made up folders instead of against today's
repository.

## Existence is not the rule

A README that exists and says nothing is **worse** than no README, because it turns the check green
and stops anyone asking again. Ask twenty-six folders for a file and you get twenty-six files saying
"This folder contains helpers."

So a README must **name at least one file that genuinely lives in the folder**. It is cheap to
satisfy honestly and impossible to satisfy with boilerplate, because the filenames differ per folder
and a writer who lists them has had to look at what is in there.

`selfTest` proves exactly that: a filler README naming none of its own files must be _rejected_.

## The backlog can only shrink

The rule arrived long after the code, and demanding twenty-five READMEs in one commit is precisely
how filler gets written. `scripts/folder-readme-backlog.json` excuses the folders not yet done.

- `--update` drops every folder that now passes, and can never add one.
- `--seed` is separate and deliberately awkward, so nobody reaches for it to make a failing check go
  away.
- A backlog entry naming a folder with no source is itself a failure: an excuse attached to nothing
  keeps the count looking like work remains when it does not.

The remaining count is printed **on success**, because a guard that says only "all good" while
holding a list of known gaps is telling the half of the truth that needs no action.

## Modes

```
npm run check:readmes                             # self test, then the repository
node scripts/check-folder-readmes.ts --update     # after documenting a folder
node scripts/check-folder-readmes.ts --self-test  # the rules alone
```

⚠️ Flags go through `node`, not `npm run ... --`. npm 12 parses unknown flags itself even after the
separator and exits before the script runs.

## Known limits

`git ls-files` only sees **tracked** files, so a brand new folder is invisible until it is staged.
That is the same blind spot `check:sizes` has, and it is why seeding this backlog the first time
produced three folders named `playwright.config.t`, `vite.config.t` and `vitest.config.t`: a
root-level file has no `/`, and `slice(0, -1)` shaves a character off rather than returning an empty
string. Three plausible looking entries that named nothing.
