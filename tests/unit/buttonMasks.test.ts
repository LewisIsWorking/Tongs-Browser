import { describe, expect, it } from 'vitest';

import {
  ButtonsMask,
  MouseButton,
  maskForButton,
  withButtonReleased,
} from '../../src/pointer/buttons.js';

/**
 * The two mouse button numbering schemes, which are NOT the same order. Written 2026-08-31.
 *
 * ⚠️ `buttons.ts` says it outright: "Note that middle and right are not in button order." `button`
 * counts LEFT 0, MIDDLE 1, RIGHT 2. The `buttons` bitmask is LEFT 1, RIGHT 2, MIDDLE 4. So the
 * obvious implementation, `1 << button`, maps MIDDLE onto RIGHT's bit and RIGHT onto MIDDLE's - a
 * swap that is invisible for left click, which is almost everything anyone tests by hand.
 *
 * The file's own header calls mixing the two schemes "the classic source of 'right click does
 * nothing'". This pins the whole table so the mapping cannot be rewritten into the plausible form.
 */
describe('mapping a button to its bitmask', () => {
  it.each([
    ['left', MouseButton.LEFT, ButtonsMask.LEFT],
    ['right', MouseButton.RIGHT, ButtonsMask.RIGHT],
    ['middle', MouseButton.MIDDLE, ButtonsMask.MIDDLE],
  ])('maps %s', (_name, button, mask) => {
    expect(maskForButton(button)).toBe(mask);
  });

  /** ⚠️ The two schemes genuinely disagree, and this is the assertion that says so out loud. */
  it('does not simply shift the button number, which would swap middle and right', () => {
    expect(maskForButton(MouseButton.MIDDLE)).not.toBe(1 << MouseButton.MIDDLE);
    expect(maskForButton(MouseButton.RIGHT)).not.toBe(1 << MouseButton.RIGHT);
  });
});

describe('releasing one button while others are held', () => {
  /**
   * ⚠️ The mask has to survive a drag's move stream: `buttons` is what tells Foundry a button is
   * still down, and clearing the wrong bit ends the drag as far as Foundry is concerned.
   */
  it('clears only the button released', () => {
    const held = ButtonsMask.LEFT | ButtonsMask.MIDDLE;

    expect(withButtonReleased(held, MouseButton.MIDDLE)).toBe(ButtonsMask.LEFT);
    expect(withButtonReleased(held, MouseButton.LEFT)).toBe(ButtonsMask.MIDDLE);
  });

  it('leaves the mask alone when the released button was not held', () => {
    expect(withButtonReleased(ButtonsMask.LEFT, MouseButton.RIGHT)).toBe(ButtonsMask.LEFT);
  });

  it('empties the mask when the only held button is released', () => {
    expect(withButtonReleased(ButtonsMask.LEFT, MouseButton.LEFT)).toBe(ButtonsMask.NONE);
  });
});
