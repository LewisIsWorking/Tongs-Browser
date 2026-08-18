import { describe, expect, it } from 'vitest';

import {
  LIMIT,
  countLines,
  findProblems,
  onlySlack,
  tightened,
} from '../../scripts/sizes/ratchet.ts';

/**
 * The 200 line rule, tested against made up inputs rather than against today's repository.
 *
 * ⚠️ These exist because `scripts/sizes/ratchet.ts` already carried a `selfTest()` that NOTHING RAN.
 * It was reachable only through `check:sizes -- --self-test`, which appears in no npm script and no
 * workflow, so the guard's own proof had never executed in CI. A proof nobody invokes is a proof that
 * cannot fail, which is the same as not having one. `check:sizes` now runs it, and these run in the
 * ordinary suite as well.
 */
const OVER: ReadonlyMap<string, number> = new Map([['tests/big.test.ts', 301]]);

describe('counting lines', () => {
  /** ⚠️ Newline separated, trailing blank included, matching how the project counts everywhere else. */
  it('counts the trailing line a file ends on', () => {
    expect(countLines('a\nb\n')).toBe(3);
    expect(countLines('a\nb')).toBe(2);
  });

  it('counts an empty file as one line', () => {
    expect(countLines('')).toBe(1);
  });
});

describe('the hard limit', () => {
  it('fails a src/ file over the limit', () => {
    const problems = findProblems(new Map([['src/a.ts', LIMIT + 1]]), {});

    expect(problems).toHaveLength(1);
    expect(problems[0]?.reason).toBe('over the hard limit');
  });

  /** ⚠️ A ratchet entry must NOT excuse a src/ file, or the strict half quietly becomes the loose half. */
  it('refuses to let a ratchet entry excuse a src/ file', () => {
    expect(findProblems(new Map([['src/a.ts', 201]]), { 'src/a.ts': 500 })).toHaveLength(1);
  });

  /** A new file with no entry is judged against the limit, so it cannot be born into the backlog. */
  it('judges an unlisted file against the limit, not the backlog', () => {
    const problems = findProblems(OVER, {});

    expect(problems[0]?.reason).toBe('over the hard limit');
  });

  it('passes a file at exactly the limit', () => {
    expect(findProblems(new Map([['src/a.ts', LIMIT]]), {})).toEqual([]);
  });
});

describe('the backlog ratchet', () => {
  it('passes a listed file sitting exactly on its ceiling', () => {
    expect(findProblems(OVER, { 'tests/big.test.ts': 301 })).toEqual([]);
  });

  it('fails a listed file that grew', () => {
    const problems = findProblems(OVER, { 'tests/big.test.ts': 300 });

    expect(problems[0]?.reason).toBe('grew past its ratchet');
    expect(problems[0]?.ceiling).toBe(300);
  });
});

/**
 * ⚠️ THE BUG THIS SUITE WAS WRITTEN FOR, 2026-08-18. `findProblems` checked only `lines > ceiling`,
 * so a file that SHRANK kept its old ceiling until somebody remembered to run `--update`. That is the
 * high water mark the module's own docblock warns against: shrink a file from 284 to 230, the check
 * reports green, and all 54 lines may silently come back.
 */
describe('slack below the ratchet', () => {
  it('fails a listed file that shrank, so the reduction gets recorded', () => {
    const problems = findProblems(new Map([['tests/big.test.ts', 250]]), {
      'tests/big.test.ts': 300,
    });

    expect(problems).toHaveLength(1);
    expect(problems[0]?.reason).toBe('has slack below its ratchet');
  });

  it('fails a listed file that dropped clear of the limit entirely', () => {
    const problems = findProblems(new Map([['tests/big.test.ts', 20]]), {
      'tests/big.test.ts': 300,
    });

    expect(problems[0]?.reason).toBe('has slack below its ratchet');
  });

  /** ⚠️ Slack must not be reported for src/, which has no ceiling to be slack against. */
  it('says nothing about a small src/ file', () => {
    expect(findProblems(new Map([['src/a.ts', 10]]), { 'src/a.ts': 300 })).toEqual([]);
  });

  /**
   * The two situations need two different instructions. "Extract a responsibility" is right for a
   * file that grew and precisely wrong for one that shrank.
   */
  it('is distinguishable from growth, so the advice can differ', () => {
    const shrank = findProblems(new Map([['tests/big.test.ts', 250]]), {
      'tests/big.test.ts': 300,
    });
    const grew = findProblems(OVER, { 'tests/big.test.ts': 300 });

    expect(onlySlack(shrank)).toBe(true);
    expect(onlySlack(grew)).toBe(false);
    expect(onlySlack([...shrank, ...grew])).toBe(false);
  });

  it('is not claimed when nothing is wrong at all', () => {
    expect(onlySlack([])).toBe(false);
  });
});

describe('recording a new list', () => {
  it('records a reduction', () => {
    expect(tightened(new Map([['tests/b.test.ts', 250]]), { 'tests/b.test.ts': 300 })).toEqual({
      'tests/b.test.ts': 250,
    });
  });

  /** ⚠️ An increase must never become the new ceiling, whatever route it arrives by. */
  it('keeps the old ceiling when a file grew', () => {
    expect(tightened(new Map([['tests/b.test.ts', 350]]), { 'tests/b.test.ts': 300 })).toEqual({
      'tests/b.test.ts': 300,
    });
  });

  it('drops a file that fell below the limit, and one that vanished', () => {
    expect(tightened(new Map([['tests/b.test.ts', 10]]), { 'tests/b.test.ts': 300 })).toEqual({});
    expect(tightened(new Map(), { 'tests/gone.test.ts': 300 })).toEqual({});
  });

  it('never records a src/ file, however long it is', () => {
    expect(tightened(new Map([['src/a.ts', 900]]), {})).toEqual({});
  });
});
