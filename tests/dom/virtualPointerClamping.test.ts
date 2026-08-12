import { describe, expect, it } from 'vitest';

import { createPointer, makeRegion } from './support/pointerHarness.js';

describe('VirtualPointer viewport clamping', () => {
  it('clamps an off screen move rather than losing the pointer', () => {
    makeRegion('edge', 900, 0, 100, 800);
    const pointer = createPointer({ clientX: 500, clientY: 400 });

    pointer.moveTo({ clientX: 5000, clientY: 400 });

    expect(pointer.getPosition()).toEqual({ clientX: 999, clientY: 400 });
  });

  /**
   * Without recording the clamped position back into state, repeated off screen moves would
   * accumulate an invisible offset the user would have to swipe all the way back through before the
   * cursor appeared to move again.
   */
  it('does not accumulate an invisible offset across repeated off screen moves', () => {
    makeRegion('edge', 900, 0, 100, 800);
    const pointer = createPointer({ clientX: 500, clientY: 400 });

    pointer.moveBy(5000, 0);
    pointer.moveBy(5000, 0);
    pointer.moveBy(-100, 0);

    expect(pointer.getPosition()).toEqual({ clientX: 899, clientY: 400 });
  });
});
