import { afterEach, describe, expect, it } from 'vitest';

import { fear, jaws, panelWith, root, tap } from './support/deckPanelWorld.js';

/**
 * Swiping between cards on the panel. Written 2026-09-14.
 *
 * ⚠️ jsdom has no Touch constructor, so the events carry plain objects with the two coordinates the
 * listener reads. A real touchscreen is exercised by the live probe, not here.
 */
afterEach(() => {
  document.body.replaceChildren();
});

type Point = readonly [number, number];

const touch = (type: string, touches: readonly Point[], changed: readonly Point[]) => {
  const event = new Event(type, { bubbles: true });
  const list = (points: readonly Point[]) =>
    points.map(([clientX, clientY]) => ({ clientX, clientY }));
  Object.defineProperty(event, 'touches', { value: list(touches) });
  Object.defineProperty(event, 'changedTouches', { value: list(changed) });
  root()?.dispatchEvent(event);
};

const swipe = (from: Point, to: Point) => {
  touch('touchstart', [from], [from]);
  touch('touchend', [], [to]);
};

const position = () => root()?.querySelector('header p')?.textContent;

describe('swiping', () => {
  it('moves to the next card with a leftward swipe, and back with a rightward one', () => {
    panelWith([jaws, fear]).panel.open();

    swipe([300, 400], [100, 410]);
    expect(position()).toBe('Card 2 of 2');

    swipe([100, 400], [300, 400]);
    expect(position()).toBe('Card 1 of 2');
  });

  it('ignores a vertical scroll', () => {
    panelWith([jaws, fear]).panel.open();

    swipe([200, 700], [150, 300]);

    expect(position()).toBe('Card 1 of 2');
  });

  /** ⚠️ A stray swipe must not throw away creatures half chosen for a save. */
  it('does nothing while a choice is being made', () => {
    panelWith([fear, jaws]).panel.open();
    tap('Choose who rolls Will DC 17');

    swipe([300, 400], [100, 400]);

    expect(position()).toBe('Card 1 of 2');
    expect(root()?.textContent).toContain('Who rolls?');
  });

  it('does nothing while PF2e is working', () => {
    const { panel, deck } = panelWith([jaws, fear]);
    deck.apply.mockReturnValueOnce(new Promise(() => undefined));
    panel.open();
    tap('Apply 6 piercing and fire to Xorn');

    swipe([300, 400], [100, 400]);

    expect(position()).toBe('Card 1 of 2');
  });

  it('is cancelled by a second finger, and by a cancelled touch', () => {
    panelWith([jaws, fear]).panel.open();

    touch(
      'touchstart',
      [
        [300, 400],
        [320, 420],
      ],
      [[320, 420]]
    );
    touch('touchend', [], [[100, 400]]);
    touch('touchstart', [[300, 400]], [[300, 400]]);
    touch('touchcancel', [], [[300, 400]]);
    touch('touchend', [], [[100, 400]]);
    touch('touchstart', [[300, 400]], [[300, 400]]);
    touch('touchend', [[300, 400]], [[100, 400]]);

    expect(position()).toBe('Card 1 of 2');
  });

  it('ignores a touchend with no touch to read', () => {
    panelWith([jaws, fear]).panel.open();

    touch('touchstart', [[300, 400]], [[300, 400]]);
    touch('touchend', [], []);

    expect(position()).toBe('Card 1 of 2');
  });
});
