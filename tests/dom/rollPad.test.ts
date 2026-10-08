import { afterEach, describe, expect, it, vi } from 'vitest';

import { HOLD_MS } from '../../src/rollpad/padPress.js';
import { RollPad } from '../../src/rollpad/RollPad.js';
import { buildRollPad } from '../../src/rollpad/buildRollPad.js';
import { padActor } from '../unit/support/rollPadActor.js';

/**
 * The Roll Pad on screen: tabs, a tap, a long press, and what it says when it cannot roll. Written
 * 2026-10-08. What each roll calls in PF2e is asserted in `tests/unit/rollPadModel.test.ts`.
 */
afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

const root = () => document.querySelector<HTMLElement>('.tb-roll-pad');
const buttons = (selector = '.tb-roll-pad__roll') => [
  ...document.querySelectorAll<HTMLButtonElement>(selector),
];
const named = (text: string) => {
  const found = buttons('button').find((button) => button.textContent === text);
  if (found === undefined) throw new Error(`No button '${text}'.`);
  return found;
};
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const press = (button: HTMLButtonElement, ...types: string[]) => {
  for (const type of types) button.dispatchEvent(new PointerEvent(type));
};

const padWith = (actor: unknown = padActor()) => {
  const roll = vi.fn(() => Promise.resolve(true));
  const pad = new RollPad({ document, character: () => actor, roll });
  pad.open();
  return { pad, roll, actor };
};

describe('the pad', () => {
  it('opens on the strikes, as our own interface, with the weapon not in hand switched off', () => {
    padWith();

    expect(root()?.getAttribute('data-tongs-browser')).toBe('ignore');
    expect(root()?.querySelector('.tb-roll-pad__name')?.textContent).toBe('Thorin');
    expect(buttons().map((button) => [button.textContent, button.disabled])).toEqual([
      ['Strike +9', false],
      ['MAP -5', false],
      ['MAP -10', false],
      ['Damage', false],
      ['Crit', false],
      ['Strike +7', true],
      ['Damage', true],
    ]);
    const titles = [...document.querySelectorAll('.tb-roll-pad__title')];
    expect(titles.map((title) => title.textContent)).toEqual([
      'Longsword',
      'Shortbow (not in hand)',
    ]);
  });

  it('switches tabs, and opens again on the tab it was left on', () => {
    const { pad } = padWith();

    named('Checks').click();
    expect(buttons().map((button) => button.textContent)).toEqual([
      'Perception +6',
      'Fortitude +8',
      'Reflex +4',
      'Will -1',
    ]);
    named('Skills').click();
    expect(buttons()[0]?.textContent).toBe('Athletics +7');
    expect(
      buttons().filter((b) => b.classList.contains('tb-roll-pad__roll--untrained'))
    ).toHaveLength(2);

    pad.close();
    pad.open();
    pad.open();
    expect(document.querySelectorAll('.tb-roll-pad')).toHaveLength(1);
    expect(buttons()[0]?.textContent).toBe('Athletics +7');
  });

  it('starts on Checks for a character with no strikes, and says so on Strikes', () => {
    padWith({ name: 'Ezren', perception: { label: 'Perception', mod: 5, roll: () => undefined } });

    expect(buttons().map((button) => button.textContent)).toEqual(['Perception +5']);
    named('Strikes').click();
    expect(root()?.textContent).toContain('Ezren has no strikes.');
    named('Skills').click();
    expect(root()?.textContent).toContain('Ezren has nothing to roll here.');
  });

  it('tells a player with no character how to get one', () => {
    padWith(null);

    expect(root()?.textContent).toContain('No character to roll for.');
    named('Close').click();
    expect(root()).toBeNull();
  });
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
