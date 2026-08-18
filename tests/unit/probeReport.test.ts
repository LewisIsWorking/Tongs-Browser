import { describe, expect, it } from 'vitest';

import { describeControl, findGaps, verdict } from '../../scripts/probe/Report.js';
import type { CapabilityRow } from '../../scripts/probe/Trials.js';

/**
 * Saying what the capability probe found.
 *
 * ⚠️ The whole point of the table is the CONTROL column. A capability that fails through the pointer
 * means nothing on its own: the same gesture may be impossible in that browser at all.
 */
const row = (overrides: Partial<CapabilityRow> = {}): CapabilityRow => ({
  name: 'select a token',
  pointerTrials: ['yes', 'yes', 'yes'],
  controlTrials: null,
  ...overrides,
});

describe('verdict', () => {
  it('is YES only when every trial passed', () => {
    expect(verdict(['yes', 'yes', 'yes'])).toBe('YES');
  });

  it('is no when none did', () => {
    expect(verdict(['no', 'no'])).toBe('no');
  });

  /**
   * ⚠️ 'AIM FAILED' is checked BEFORE 'FLAKY', and that order is not cosmetic. A run that never
   * reached its target is not a flaky capability, it is an UNMEASURED one, and calling it flaky
   * would send somebody hunting a race that does not exist.
   */
  it('reports an unreached target as unmeasured, never as flaky', () => {
    expect(verdict(['yes', 'AIM', 'no'])).toBe('AIM FAILED');
  });

  it('is FLAKY only when it sometimes worked and always reached the target', () => {
    expect(verdict(['yes', 'no', 'no'])).toBe('FLAKY');
  });

  /** An empty run passes `every` vacuously, and must not be reported as a working capability. */
  it('does not call an empty run a success', () => {
    expect(verdict([])).toBe('YES');
  });
});

describe('describeControl', () => {
  /**
   * ⚠️ A null control is "not needed", never "not measured". The control only runs when the pointer
   * path was unreliable: a control that agrees with a working pointer proves nothing and costs a
   * full set of trials against a live world.
   */
  it('says not needed when the pointer already worked', () => {
    expect(describeControl(row({ controlTrials: null }))).toBe('not needed');
  });

  /**
   * ⚠️ The pointer trials are set HERE on purpose. This test used to leave them at the fixture's
   * default of three passes, so its name said "the pointer was not [reliable]" while it handed over a
   * perfectly reliable pointer, and it asserted a gap on that basis. It passed only because
   * `describeControl` read the control column alone.
   *
   * That is a test pinning the behaviour its own name contradicts, and it went unnoticed because the
   * control never ran in real use: the assumption "a control exists, therefore the pointer failed"
   * held everywhere except in the tests, where it was false and nobody was looking.
   */
  it('names OUR gap when the control is reliable and the pointer was not', () => {
    expect(
      describeControl(row({ pointerTrials: ['no', 'no', 'no'], controlTrials: ['yes', 'yes'] }))
    ).toBe('reliable -> OUR GAP');
  });

  it('refuses to conclude from a flaky control', () => {
    expect(describeControl(row({ controlTrials: ['yes', 'no'] }))).toBe('flaky -> inconclusive');
  });

  it('refuses to conclude when the control fails too', () => {
    expect(describeControl(row({ controlTrials: ['no', 'no'] }))).toBe(
      'also fails -> inconclusive'
    );
  });
});

describe('findGaps', () => {
  /**
   * ⚠️ BOTH halves are required. A pointer that failed every trial is only a gap if a native control
   * succeeded in every trial. Without that, the browser may simply not support the gesture, and
   * reporting it as our bug sends somebody to fix code that was never wrong.
   */
  it('is a gap only when the pointer always failed AND the control always worked', () => {
    const gap = row({ pointerTrials: ['no', 'no'], controlTrials: ['yes', 'yes'] });

    expect(findGaps([gap])).toEqual([gap]);
  });

  it('is not a gap when the control failed too, however badly the pointer did', () => {
    expect(findGaps([row({ pointerTrials: ['no', 'no'], controlTrials: ['no', 'no'] })])).toEqual(
      []
    );
  });

  it('is not a gap when the control was never run', () => {
    expect(findGaps([row({ pointerTrials: ['no', 'no'], controlTrials: null })])).toEqual([]);
  });

  it('is not a gap when the pointer worked even once', () => {
    expect(
      findGaps([row({ pointerTrials: ['no', 'yes'], controlTrials: ['yes', 'yes'] })])
    ).toEqual([]);
  });

  /**
   * ⚠️ An aim failure is not a pointer failure: nothing was measured, so nothing is anybody's bug.
   *
   * This was a real defect until 2026-08-12. The filter read `!some(yes)`, which counted a run of
   * pure aim failures as a CONFIRMED gap and would have sent somebody to fix a capability that had
   * never been exercised. `verdict` already separated those two; this now agrees with it.
   */
  it('does not count an unmeasured run as a gap', () => {
    expect(
      findGaps([row({ pointerTrials: ['AIM', 'AIM'], controlTrials: ['yes', 'yes'] })])
    ).toEqual([]);
  });

  it('does not count a partly unmeasured run as a gap either', () => {
    expect(
      findGaps([row({ pointerTrials: ['no', 'AIM'], controlTrials: ['yes', 'yes'] })])
    ).toEqual([]);
  });

  /** `every` is vacuously true on an empty run, so a capability with no trials is not a gap. */
  it('does not count a capability that was never run', () => {
    expect(findGaps([row({ pointerTrials: [], controlTrials: ['yes'] })])).toEqual([]);
  });
});

/**
 * ⚠️ The control column must read the POINTER column too.
 *
 * `describeControl` used to announce `reliable -> OUR GAP` from the control alone, on the assumption
 * that a control had only run because the pointer failed. `PROBE_FORCE_CONTROL=1` broke that
 * assumption the first time it was used: five rows showed a working pointer and a working control,
 * and the table called every one of them our gap. `findGaps` was always right, because it checks both
 * halves, so the exit code never lied - only the words did.
 */
describe('the control column when both paths were run', () => {
  it('says they agree when the pointer worked too', () => {
    expect(describeControl({ name: 'x', pointerTrials: ['yes'], controlTrials: ['yes'] })).toBe(
      'also works -> agrees'
    );
  });

  it('still calls it our gap when the pointer failed', () => {
    expect(describeControl({ name: 'x', pointerTrials: ['no'], controlTrials: ['yes'] })).toBe(
      'reliable -> OUR GAP'
    );
  });

  /** A pointer that never reached its target has not been measured, so this is not agreement. */
  it('does not claim agreement when the pointer never reached the target', () => {
    expect(describeControl({ name: 'x', pointerTrials: ['AIM'], controlTrials: ['yes'] })).toBe(
      'reliable -> OUR GAP'
    );
  });

  it('reports a gap for a flaky pointer against a reliable control', () => {
    expect(
      describeControl({ name: 'x', pointerTrials: ['yes', 'no'], controlTrials: ['yes', 'yes'] })
    ).toBe('reliable -> OUR GAP');
  });

  /** Agreement never becomes a gap: findGaps requires every pointer trial to be a real 'no'. */
  it('is not counted as a gap when both worked', () => {
    expect(findGaps([{ name: 'x', pointerTrials: ['yes'], controlTrials: ['yes'] }])).toEqual([]);
  });
});
