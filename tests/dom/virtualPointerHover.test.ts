import { describe, expect, it } from 'vitest';

import { createPointer, makeRegion, recorded } from './support/pointerHarness.js';

describe('VirtualPointer hover transitions', () => {
  it('fires enter on the first element the pointer reaches', () => {
    makeRegion('a', 0, 0, 100, 100);
    const pointer = createPointer({ clientX: 500, clientY: 500 });

    pointer.moveTo({ clientX: 50, clientY: 50 });

    expect(recorded.map((entry) => `${entry.target}:${entry.type}`)).toEqual([
      'a:pointerover',
      'a:pointerenter',
      'a:mouseover',
      'a:mouseenter',
      'a:pointermove',
      'a:mousemove',
    ]);
  });

  /**
   * This ordering is what makes tooltips, token nameplates and the PF2e HUD work. A move that only
   * emitted pointermove would look correct and silently kill every hover affordance in Foundry.
   */
  it('leaves the old element before entering the new one when crossing a boundary', () => {
    makeRegion('a', 0, 0, 100, 100);
    makeRegion('b', 100, 0, 100, 100);
    const pointer = createPointer({ clientX: 50, clientY: 50 });

    pointer.moveTo({ clientX: 50, clientY: 50 });
    recorded.length = 0;
    pointer.moveTo({ clientX: 150, clientY: 50 });

    expect(recorded.map((entry) => `${entry.target}:${entry.type}`)).toEqual([
      'a:pointerout',
      'a:pointerleave',
      'a:mouseout',
      'a:mouseleave',
      'b:pointerover',
      'b:pointerenter',
      'b:mouseover',
      'b:mouseenter',
      'b:pointermove',
      'b:mousemove',
    ]);
  });

  it('emits only a move when staying within the same element', () => {
    makeRegion('a', 0, 0, 100, 100);
    const pointer = createPointer({ clientX: 10, clientY: 10 });

    pointer.moveTo({ clientX: 10, clientY: 10 });
    recorded.length = 0;
    pointer.moveTo({ clientX: 20, clientY: 20 });

    expect(recorded.map((entry) => entry.type)).toEqual(['pointermove', 'mousemove']);
  });

  it('leaves the old element and enters nothing when moving onto empty space', () => {
    makeRegion('a', 0, 0, 100, 100);
    const pointer = createPointer({ clientX: 10, clientY: 10 });

    pointer.moveTo({ clientX: 10, clientY: 10 });
    recorded.length = 0;
    pointer.moveTo({ clientX: 500, clientY: 500 });

    expect(recorded.map((entry) => `${entry.target}:${entry.type}`)).toEqual([
      'a:pointerout',
      'a:pointerleave',
      'a:mouseout',
      'a:mouseleave',
    ]);
  });
});
