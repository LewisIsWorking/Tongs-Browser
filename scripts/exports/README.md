# scripts/exports

Exported values that nothing uses.

| File       | What it is                                            |
| ---------- | ----------------------------------------------------- |
| `rules.ts` | What counts as dead, and the self test that proves it |

The command line lives in `scripts/check-dead-exports.ts`. Same split as `scripts/sizes` and
`scripts/readmes`: the rules can then be exercised against made up files rather than against today's
tree.

## Why it exists

Three files in a row were opened because coverage was low, and each time the uncovered part was an
exported value nothing called. **Coverage was the only thing pointing at any of it, and it answers
the wrong question:** untested and unreachable need completely different work.

A sweep found ten. Six were unreachable and were deleted; one of those, `ALL_KEYS`, only became
visibly dead once `findKey` was removed, and the typechecker found it. Four were live but
over-exported.

`check:support` asks this same question of shared test fixtures. This asks it of production code.

## Values only, which is a measurement rather than a preference

Functions, consts and classes. Types are exempt.

Including types produced **64** findings, most of them correct code: an `Options` interface naming a
constructor argument is referenced only inside its own file whenever callers pass an object literal,
which is nearly always. Restricting to values produced **10, and all 10 were real**.

A guard that cries wolf 54 times is a guard people learn to skip, so the narrower rule is the more
useful one.

## Two findings, two fixes

The report distinguishes them, because the remedy differs:

- **used nowhere at all** - delete it
- **used only inside its own file** - drop the `export`

## Deliberate bias

Whole-word matching, and comments are not stripped. That direction is safe: a mention in a comment
makes this guard **miss** a dead export, never invent one. The opposite bias reports live code as
dead, which is how a guard gets deleted instead of fixed.

Only `src/` is judged. A script or a test may reasonably export a helper for a reader's benefit.
