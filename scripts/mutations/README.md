# Recorded mutations

A defect that a green build could not see, kept so that it stays seen.

`recorded.ts` is the list, `runner.ts` applies one and reads the verdict, and `../check-mutations.ts`
is the entry point. Run it with `npm run check:mutations`.

## Why this exists and the ratchet does not cover it

The coverage ratchet in `vitest.config.ts` asks whether a line **ran**. Every mutation in this folder
ran the line it changed, at full coverage, and still shipped a wrong answer. The first one recorded
here survived eleven tests, and survived the first test written specifically to close it.

## Adding one

Add an entry when you find a defect that a passing test suite did not notice. In order:

1. Apply the wrong version by hand and confirm the tests **pass** with it. If they already fail,
   there is nothing to record.
2. Write or fix the test until they fail.
3. Record it here, and run `npm run check:mutations` to confirm it is caught.

Write `defect` as the bug a user would report, not as the edit. "Acts on the first party in the list
rather than the one tapped" is a bug; "removes the find call" is a diff.

## The two traps this is built around

**Never read the verdict from an exit code.** A hand-rolled version of this reported a kill that
never happened: the arguments were wrong, vitest treated a label as a test filter, nothing matched,
and it exited 1. A non-zero exit means "something went wrong", and "no tests ran" is the most likely
something. The verdict comes from the `Tests N failed | M passed` summary line or the run is reported
as `NO TESTS RAN`.

**Anchor on text, not line numbers.** Line numbers rot on the first edit above them, and a stale one
mutates an innocent line, producing a survivor that is really a mutation of nothing. An anchor that
appears more than once is a hard error rather than a first-match replace, because silently taking the
first of two identical lines is how a hand-rolled version produced false survivors.

## It edits your source files

Each mutation is written into the real file and put back in a `finally`, then the restore is verified
by comparing content. Do not run it with an editor that might write the file back underneath it.
`git diff` is not a safe way to check afterwards: a file git does not track yet has no diff to show,
which is exactly the state a new file is in while its mutations are being written.
