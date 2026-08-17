import { describe, expect, it } from 'vitest';

import { actionableTouches } from '../../src/gesture/ActionableTouches.js';
import { ExclusionZones } from '../../src/gesture/ExclusionZones.js';

/**
 * The filter on its own, for the two cases the binder cannot produce.
 *
 * The behaviour that matters is asserted through TouchBinder in touchBinderExcludedFinger.test.ts,
 * where it is an outcome rather than a mechanism. These two are here because a `TouchList` is an
 * interface over a live collection and can hand back `null` for an index inside its own length -
 * jsdom has no TouchList at all, so nothing upstream will ever generate that, and skipping the branch
 * would leave a `continue` in the touch path that has never once executed.
 */
describe('actionableTouches, directly', () => {
  it('is empty for no fingers at all', () => {
    const empty = { length: 0, item: () => null } as unknown as TouchList;

    expect(actionableTouches(empty, new ExclusionZones())).toEqual([]);
  });

  it('skips a slot that reports null inside its own length', () => {
    const canvas = document.createElement('canvas');
    document.body.append(canvas);
    const gappy = {
      length: 2,
      item: (index: number) =>
        index === 0 ? null : { identifier: 7, clientX: 5, clientY: 6, target: canvas },
    } as unknown as TouchList;

    expect(actionableTouches(gappy, new ExclusionZones())).toEqual([
      { id: 7, clientX: 5, clientY: 6 },
    ]);
  });
});
