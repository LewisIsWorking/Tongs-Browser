import { describe, expect, it } from 'vitest';

import { describeServerAbsence, type LockFinding } from '../../scripts/foundry/serverAbsence.ts';

/**
 * What the harness says when nothing answers.
 *
 * ⚠️ Every case here is a real 2026-08-15 evening, not an invented one. The server exited with code 4
 * leaving an empty `Config/options.json.lock` behind; two launches then failed instantly with
 * "already locked by another process"; and throughout, a healthy Foundry was answering on :30001
 * against a different dataPath. The old message covered all three with "Start Foundry and launch a
 * world."
 */
const ABSENT: LockFinding = { kind: 'absent', path: 'C:/data/Config/options.json.lock' };

describe('when nothing is answering', () => {
  it('always names the address that failed and what to do about it', () => {
    const said = describeServerAbsence('http://localhost:30000', ABSENT);

    expect(said).toContain('http://localhost:30000');
    expect(said).toContain('Start Foundry and launch a world.');
  });

  it('says nothing about locks or neighbours when there is nothing to say', () => {
    const said = describeServerAbsence('http://localhost:30000', ABSENT);

    expect(said).not.toContain('LOCK');
    expect(said).not.toContain('answering elsewhere');
  });
});

/** A present lock while the port is silent is necessarily stale, and that is the whole finding. */
describe('a stale lock', () => {
  const held: LockFinding = { kind: 'held', path: 'C:/data/Config/options.json.lock' };

  it('names the directory and the error it will cause', () => {
    const said = describeServerAbsence('http://localhost:30000', held);

    expect(said).toContain('C:/data/Config/options.json.lock');
    expect(said).toContain('already locked by another process');
    expect(said).toContain('Remove that directory first');
  });

  /**
   * ⚠️ The reason this message exists. Following the generic advice reproduces the fatal error, so
   * the lock has to be mentioned in the same breath, not instead.
   */
  it('still tells the reader to start Foundry, after removing it', () => {
    const said = describeServerAbsence('http://localhost:30000', held);

    expect(said.indexOf('Start Foundry')).toBeLessThan(said.indexOf('STALE LOCK'));
  });
});

/**
 * ⚠️ `absent` and `unchecked` must not read the same. Both add no warning, but only `absent` has
 * earned the silence - `unchecked` never looked, and a diagnostic that implies a clean check it did
 * not run is worse than one that admits the gap.
 */
describe('a lock that could not be checked', () => {
  it('admits the gap rather than implying a clean check', () => {
    const said = describeServerAbsence('http://localhost:30000', {
      kind: 'unchecked',
      why: 'no FOUNDRY_DATA_PATH set',
    });

    expect(said).toContain('was not checked');
    expect(said).toContain('no FOUNDRY_DATA_PATH set');
    expect(said).toContain('not ruled out');
  });

  it('differs from the message for a lock that is genuinely absent', () => {
    const unchecked = describeServerAbsence('http://x:1', { kind: 'unchecked', why: 'because' });

    expect(unchecked).not.toBe(describeServerAbsence('http://x:1', ABSENT));
  });
});

/**
 * A healthy Foundry one port over is the difference between a one-line correction and a hunt. This
 * machine genuinely runs two: :30000 for the module, :30001 for an isolated harness world.
 */
describe('a Foundry answering somewhere else', () => {
  it('names the port and the world it has open', () => {
    const said = describeServerAbsence('http://localhost:30000', ABSENT, [
      { base: 'http://localhost:30001', world: 'cooharness' },
    ]);

    expect(said).toContain('http://localhost:30001');
    expect(said).toContain("world 'cooharness'");
    expect(said).toContain('FOUNDRY_HOST_URL');
  });

  /**
   * ⚠️ The warning that stops the correction being a trap. :30001 runs against a separate dataPath
   * whose `modules/` folder is empty, so pointing the checks at it swaps "nothing is answering" for
   * a module that is not installed.
   */
  it('warns that a different dataPath has its own modules', () => {
    const said = describeServerAbsence('http://localhost:30000', ABSENT, [
      { base: 'http://localhost:30001', world: 'cooharness' },
    ]);

    expect(said).toContain('own modules');
    expect(said).toContain('tongs-browser');
  });

  it('distinguishes a server with no world from one with a world', () => {
    const said = describeServerAbsence('http://localhost:30000', ABSENT, [
      { base: 'http://localhost:30001', world: null },
    ]);

    expect(said).toContain('no world launched');
    expect(said).not.toContain("world '");
  });

  it('lists several when several answer', () => {
    const said = describeServerAbsence('http://localhost:30000', ABSENT, [
      { base: 'http://localhost:30001', world: 'cooharness' },
      { base: 'http://localhost:30002', world: null },
    ]);

    expect(said).toContain('http://localhost:30001');
    expect(said).toContain('http://localhost:30002');
  });
});
