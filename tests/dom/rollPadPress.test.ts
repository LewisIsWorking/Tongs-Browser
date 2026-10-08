import { afterEach, describe, expect, it, vi } from 'vitest';

import { HOLD_MS } from '../../src/rollpad/padPress.js';
import { buildRollPad } from '../../src/rollpad/buildRollPad.js';
import { padActor } from '../unit/support/rollPadActor.js';
import { named, padWith, press, root, settle } from './support/rollPadWorld.js';

/** The Roll Pad's presses: a tap, a long press, and what it says when it cannot roll. 2026-10-08. */
afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

describe('a press', () => {
  it('rolls without the dialog on a tap, and closes so the card can be seen', async () => {
    const { pad, roll, actor } = padWith();

    press(named('MAP -5'), 'pointerdown', 'pointerup');
    await settle();

    expect(roll).toHaveBeenCalledWith(actor, { kind: 'attack', strike: 0, variant: 1 }, false);
    expect(pad.isOpen()).toBe(false);
  });

  it('rolls through the dialog on a long press, once, and nothing on the lift', () => {
    vi.useFakeTimers();
    const { roll, actor } = padWith();
    const crit = named('Crit');

    press(crit, 'pointerdown');
    vi.advanceTimersByTime(HOLD_MS);
    press(crit, 'pointerup');

    expect(roll).toHaveBeenCalledTimes(1);
    expect(roll).toHaveBeenCalledWith(actor, { kind: 'critical', strike: 0 }, true);
  });

  it('rolls nothing for a finger that slid away or scrolled', () => {
    vi.useFakeTimers();
    const { roll } = padWith();
    const damage = named('Damage');

    press(damage, 'pointerdown', 'pointerleave', 'pointerup');
    press(damage, 'pointerdown', 'pointercancel');
    vi.advanceTimersByTime(HOLD_MS * 2);
    press(damage, 'pointerup');

    expect(roll).not.toHaveBeenCalled();
    const menu = new MouseEvent('contextmenu', { cancelable: true });
    damage.dispatchEvent(menu);
    expect(menu.defaultPrevented).toBe(true);
  });

  it('taps from the keyboard, but not from a mouse click after the pointer already did', () => {
    const { roll } = padWith();

    named('Damage').dispatchEvent(new MouseEvent('click', { detail: 1 }));
    expect(roll).not.toHaveBeenCalled();
    named('Damage').click();
    expect(roll).toHaveBeenCalledTimes(1);
  });
});

describe('when it cannot roll', () => {
  it('says the roll has gone, or why it failed, and stays open', async () => {
    const { pad, roll } = padWith();
    roll.mockResolvedValueOnce(false);
    named('Damage').click();
    await settle();
    expect(root()?.querySelector('[role="status"]')?.textContent).toBe(
      'That roll is not on the sheet any more.'
    );

    roll.mockRejectedValueOnce(new Error('no target')).mockRejectedValueOnce('plain');
    named('Damage').click();
    await settle();
    expect(root()?.textContent).toContain('The roll failed: no target');
    named('Damage').click();
    await settle();
    expect(root()?.textContent).toContain('The roll failed: plain');
    expect(pad.isOpen()).toBe(true);
  });
});

describe('in Foundry', () => {
  it('rolls for the character the sheet button means, through PF2e', async () => {
    const actor = padActor();
    const open = buildRollPad(document, { myCharacter: () => actor as never });

    open();
    named('Checks').click();
    named('Will -1').click();
    await settle();

    expect(root()).toBeNull();
  });
});
