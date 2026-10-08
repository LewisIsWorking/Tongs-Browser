import { afterEach, describe, expect, it, vi } from 'vitest';

import { buttons, named, padWith, root, settle } from './support/rollPadWorld.js';

/**
 * The Roll Pad on screen: what it shows, and its tabs. Written 2026-10-08. Presses are in
 * `rollPadPress.test.ts`; what each roll calls in PF2e is in `tests/unit/rollPadModel.test.ts`.
 */
afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

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

  it('shows a strike with no damage roll, and a check with no modifier, as far as they go', () => {
    const roll = () => undefined;
    padWith({
      name: 'Amiri',
      system: {
        actions: [{ type: 'strike', label: 'Fist', variants: [{ label: 'Strike +3', roll }] }],
      },
      perception: { label: 'Perception', roll },
    });

    expect(buttons().map((button) => button.textContent)).toEqual(['Strike +3']);
    named('Checks').click();
    expect(buttons().map((button) => button.textContent)).toEqual(['Perception']);
  });

  it('closes quietly when already closed, and stays closed when a roll answers late', async () => {
    let answer: (rolled: boolean) => void = () => undefined;
    const { pad, roll } = padWith();
    roll.mockReturnValueOnce(
      new Promise((resolve) => {
        answer = resolve;
      })
    );

    named('Damage').click();
    pad.close();
    pad.close();
    answer(false);
    await settle();

    expect(root()).toBeNull();
  });
});
