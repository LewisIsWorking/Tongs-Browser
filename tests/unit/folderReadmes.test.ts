import { describe, expect, it } from 'vitest';

import {
  findReadmeProblems,
  staleBacklogEntries,
  tightenedBacklog,
  type FolderDoc,
} from '../../scripts/readmes/rules.ts';

/**
 * What counts as a folder being documented.
 *
 * ⚠️ The rule under test is NOT "a README.md exists". A guard that checks only for the file asks
 * twenty-six folders for one and gets twenty-six files saying "This folder contains helpers", after
 * which the check is green forever and nobody has learned anything. A README must NAME AT LEAST ONE
 * FILE that genuinely lives in the folder: cheap to satisfy honestly, impossible to satisfy with
 * boilerplate, because the filenames differ per folder.
 */
const REAL: FolderDoc = {
  folder: 'src/gesture',
  files: ['src/gesture/TouchBinder.ts', 'src/gesture/ExclusionZones.ts'],
  readme: '# src/gesture\n\n`TouchBinder.ts` turns real touch into gesture input.\n',
};

describe('a folder with no README', () => {
  it('is reported, and says how much is undocumented', () => {
    const problems = findReadmeProblems([{ ...REAL, readme: null }]);

    expect(problems[0]?.reason).toBe('has no README.md');
    expect(problems[0]?.detail).toContain('2 source file(s)');
  });
});

/** ⚠️ The case the whole guard exists for. Boilerplate must not pass. */
describe('a README that names none of its own files', () => {
  it('is rejected as boilerplate', () => {
    const problems = findReadmeProblems([
      { ...REAL, readme: '# src/gesture\n\nThis folder contains helpers.\n' },
    ]);

    expect(problems[0]?.reason).toBe('names none of its own files');
  });

  it('says which files it should have mentioned', () => {
    const problems = findReadmeProblems([{ ...REAL, readme: '# nothing useful' }]);

    expect(problems[0]?.detail).toContain('TouchBinder.ts');
  });

  /** ⚠️ Naming a file from a DIFFERENT folder must not count. */
  it("is not satisfied by naming some other folder's file", () => {
    const problems = findReadmeProblems([
      { ...REAL, readme: '# src/gesture\n\nSee `PlayKit.ts` in the probe folder.\n' },
    ]);

    expect(problems[0]?.reason).toBe('names none of its own files');
  });
});

describe('a README that names its own files', () => {
  it('passes', () => {
    expect(findReadmeProblems([REAL])).toEqual([]);
  });

  it('passes when it names the second file rather than the first', () => {
    const problems = findReadmeProblems([
      { ...REAL, readme: '# src/gesture\n\n`ExclusionZones.ts` lists what to keep off.\n' },
    ]);

    expect(problems).toEqual([]);
  });
});

describe('the backlog', () => {
  it('excuses a folder while it is listed', () => {
    expect(findReadmeProblems([{ ...REAL, readme: null }], ['src/gesture'])).toEqual([]);
  });

  /** ⚠️ Reductions only. A backlog that can grow is permission rather than a plan. */
  it('drops a folder that now passes', () => {
    expect(tightenedBacklog([REAL], ['src/gesture'])).toEqual([]);
  });

  it('keeps a folder that still fails', () => {
    expect(tightenedBacklog([{ ...REAL, readme: null }], ['src/gesture'])).toEqual(['src/gesture']);
  });

  it('cannot add a folder that was never excused', () => {
    expect(tightenedBacklog([{ ...REAL, readme: null }], [])).toEqual([]);
  });

  /** An excuse attached to nothing keeps the count looking like work remains when it does not. */
  it('reports an entry naming a folder with no source', () => {
    expect(staleBacklogEntries([REAL], ['src/gone', 'src/gesture'])).toEqual(['src/gone']);
  });

  it('drops a vanished folder on update rather than carrying it', () => {
    expect(tightenedBacklog([REAL], ['src/gone'])).toEqual([]);
  });
});
