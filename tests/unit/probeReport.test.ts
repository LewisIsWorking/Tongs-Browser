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

  it('names OUR gap when the control is reliable and the pointer was not', () => {
    expect(describeControl(row({ controlTrials: ['yes', 'yes'] }))).toBe('reliable -> OUR GAP');
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
