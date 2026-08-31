import { describe, expect, it } from 'vitest';

import { describeCallSite } from '../../src/debug/DragCallSite.js';

/**
 * Naming who cancelled a drag, from a stack. Written 2026-09-01.
 *
 * ⚠️ This function has already spent two releases reporting nothing useful, and the reason is
 * recorded in its own comments: it filtered by SOURCE FILE NAME, and after bundling there is no
 * `FoundryDragHooks.ts` in any stack - every frame from this module says `tongs-browser`. The filter
 * matched nothing, the fallback fired, and it cheerfully reported `at describeCallSite (...)`: the
 * function naming itself.
 *
 * That is the worst shape a diagnostic can take. It answered every time, so nothing looked broken,
 * and the answer was always the same useless one.
 *
 * COVERS: the bundle-URL filter, the three-frame window, and every fallback for a stack that does not
 *   look the way it is supposed to.
 * MISSES: whether a real Foundry stack contains the frames this reads. Only the device harness can
 *   answer that, and the drag checks do.
 */
const stackOf = (...frames: string[]): string => ['Error: cancel', ...frames].join('\n');

describe('naming the caller that cancelled a drag', () => {
  /**
   * ⚠️ THREE frames, not one. The first Foundry frame is usually
   * `MouseInteractionManager.callback`, which says only "a placeable's handler did it" and not WHICH
   * one: `_onClickLeft` closing the HUD, a redraw, and a refused permission all arrive through
   * `callback`. The caller is the answer, and it is one frame further up.
   */
  it('names three frames, because the first one is never the answer', () => {
    const stack = stackOf(
      '    at MouseInteractionManager.callback (foundry.js:1:1)',
      '    at Token.#handleDragCancel (foundry.js:2:2)',
      '    at Token._onDragLeftCancel (foundry.js:3:3)',
      '    at somethingElse (foundry.js:4:4)'
    );

    expect(describeCallSite(stack)).toBe(
      'MouseInteractionManager.callback < Token.#handleDragCancel < Token._onDragLeftCancel'
    );
  });

  /**
   * ⚠️ THE BUG THAT COST TWO RELEASES. Our own frames are excluded by the BUNDLE name, because after
   * bundling that is the only thing identifying them. Without this the first frame is always ours and
   * the report names itself.
   */
  it('excludes our own frames, which after bundling are named by the bundle', () => {
    const stack = stackOf(
      '    at describeCallSite (http://x/modules/tongs-browser/dist/tongs-browser.js:1:1)',
      '    at wrapped (http://x/modules/tongs-browser/dist/tongs-browser.js:2:2)',
      '    at Token.#handleDragCancel (foundry.js:3:3)'
    );

    expect(describeCallSite(stack)).toBe('Token.#handleDragCancel');
  });

  it('says so plainly when every frame is ours', () => {
    const stack = stackOf(
      '    at describeCallSite (http://x/tongs-browser/dist/tongs-browser.js:1:1)',
      '    at wrapped (http://x/tongs-browser/dist/tongs-browser.js:2:2)'
    );

    expect(describeCallSite(stack)).toBe('unknown caller');
  });

  it('says so plainly when there is no stack at all', () => {
    expect(describeCallSite('')).toBe('unknown caller');
  });

  /**
   * ⚠️ A frame the pattern cannot parse is reported RAW rather than dropped. A dropped frame would
   * silently shorten the chain, and a chain of two reads as "these were the only callers" rather than
   * "one of them was unreadable".
   */
  it('reports an unparseable frame rather than discarding it', () => {
    const stack = stackOf('    <anonymous>:1:1', '    at Token.#handleDragCancel (foundry.js:2:2)');

    const described = describeCallSite(stack);

    expect(described).toContain('<anonymous>');
    expect(described).toContain('Token.#handleDragCancel');
  });

  /** The default reads this function's own stack, which is what production relies on. */
  it('still answers when called with no argument at all', () => {
    expect(describeCallSite()).toEqual(expect.any(String));
  });
});
