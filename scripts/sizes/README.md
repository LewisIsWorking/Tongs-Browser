# scripts/sizes

The 200 line limit, enforced rather than remembered.

| File         | What it is                                                 |
| ------------ | ---------------------------------------------------------- |
| `ratchet.ts` | The rules: what is too long, and what a ratchet may record |

The command line lives in `scripts/check-file-sizes.ts`; the rules are separate so they can be tested
against made up inputs rather than against whatever the repository happens to look like today. A
guard proved only by the repo passing stops proving anything the moment the repo is clean.

## Two halves, held differently

**`src/` is held at the hard limit, 200, with no exceptions.** It is genuinely clear, so there is
nothing to be pragmatic about. A ratchet entry cannot excuse a `src/` file, and `--raise` refuses it.

**Tests and harness scripts carry a backlog** in `scripts/file-size-ratchet.json`, one entry per file
still over. Each file's ceiling is its **current** length, not a round number above it.

## The ceiling must equal the current length, in both directions

A ratchet parked at a comfortable margin is a high water mark: it permits every file to regrow to its
worst ever size while reporting green the whole way.

That is why **slack is a failure too**, added 2026-08-18. The original code checked `lines > ceiling`
and nothing else, so a file that _shrank_ kept its old ceiling until somebody remembered to run
`--update`, and the margin this guard warns about could open up on its own. The docblock had
described the right rule for six days while the predicate enforced half of it.

Growth and slack print **different instructions**, because "extract a responsibility into its own
file" is right for a file that grew and precisely wrong for one that shrank.

## Modes

```
npm run check:readmes                          # self test, then the repository
node scripts/check-file-sizes.ts --update      # after shrinking something
node scripts/check-file-sizes.ts --self-test   # the rules alone
```

⚠️ Flags go through `node`. npm 12 parses unknown flags itself even after `--`, so
`npm run check:sizes -- --update` dies with `Invalid abbreviated flag "--update"` before the script
runs. The guard used to print that form as its own remedy.

`--seed` and `--raise=<file>` are separate and deliberately awkward. Seeding is the one-time act of
writing the backlog down; `--raise` names exactly one file, so a justified increase appears in the
diff as a specific number next to the commit that explains it, instead of vanishing into a bulk
rewrite.

## Counting

`countLines` splits on `\n` and includes the trailing blank, matching how the project counts
everywhere else. `wc -l` reports one fewer; do not mix them when comparing against a ceiling.
