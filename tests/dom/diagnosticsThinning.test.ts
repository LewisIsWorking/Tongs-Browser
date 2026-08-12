import { describe, expect, it } from 'vitest';

import { describeThinly } from '../../src/debug/DiagnosticsReport.js';

/**
 * The diagnostics report, which has been wrong about its own numbers three separate times.
 *
 * Each time a line stated something the code had not measured, and each time it sent the
 * investigation somewhere it did not need to go. Now that the builder is pure, those claims can be
 * asserted rather than trusted.
 */
describe('describeThinly', () => {
  /**
   * ⚠️ The single most costly line in this report's history. A confidently printed `0.0px` was read
   * as "the pointer never moved" three times over. It must refuse rather than invent a zero.
   */
  it('refuses outright when nothing was ever sampled', () => {
    expect(describeThinly({ sampled: false, peak: 0, samples: 0 }, 200)).toContain(
      'NOT MEASURABLE'
    );
    expect(describeThinly({ sampled: false, peak: 0, samples: 0 }, 200)).toContain(
      'not a distance of zero'
    );
  });

  it('states a reading plainly when the sampling covers the gesture', () => {
    expect(describeThinly({ sampled: true, peak: 120.4, samples: 180 }, 200)).toBe(
      '120.4px over 180 samples'
    );
  });

  /** 2 samples of 235 moves is not a small measurement, it is a measurement of something else. */
  it('disowns a reading sampled for almost none of the gesture', () => {
    const text = describeThinly({ sampled: true, peak: 0, samples: 2 }, 235);

    expect(text).toContain('0.0px over 2 samples of 235 moves');
    expect(text).toContain('WIPED mid drag');
  });

  /**
   * ⚠️ And it must say WIPED rather than "transient", which is what this claimed for three releases.
   * `interactionData` is a plain property that persists until `reset()`, so thin sampling is a
   * finding about Foundry rather than a measurement error to be shrugged off.
   */
  it('does not repeat the wrong explanation that the data is transient', () => {
    expect(describeThinly({ sampled: true, peak: 0, samples: 2 }, 235)).not.toContain('transient');
  });

  it('trusts a reading when there is no move count to judge it against', () => {
    expect(describeThinly({ sampled: true, peak: 5, samples: 1 }, 0)).toBe('5.0px over 1 samples');
  });
});
