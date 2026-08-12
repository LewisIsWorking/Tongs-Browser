import { describe, expect, it } from 'vitest';

import {
  ButtonsMask,
  MouseButton,
  at,
  buildDoubleClickSequence,
  buildLeftClickSequence,
  buildRightClickSequence,
  types,
} from './support/sequenceHarness.js';

describe('buildLeftClickSequence', () => {
  it('presses, releases, then activates', () => {
    expect(types(buildLeftClickSequence(at(0, 0)))).toEqual([
      'pointerdown',
      'mousedown',
      'pointerup',
      'mouseup',
      'click',
    ]);
  });

  it('holds the left bit on the press and clears it on the release', () => {
    const sequence = buildLeftClickSequence(at(0, 0));
    const byType = new Map(sequence.map((descriptor) => [descriptor.type, descriptor]));

    expect(byType.get('pointerdown')).toMatchObject({
      button: MouseButton.LEFT,
      buttons: ButtonsMask.LEFT,
    });
    expect(byType.get('pointerup')).toMatchObject({
      button: MouseButton.LEFT,
      buttons: ButtonsMask.NONE,
    });
    expect(byType.get('click')).toMatchObject({
      button: MouseButton.LEFT,
      buttons: ButtonsMask.NONE,
    });
  });
});

describe('buildRightClickSequence', () => {
  it('ends in contextmenu rather than click', () => {
    expect(types(buildRightClickSequence(at(0, 0)))).toEqual([
      'pointerdown',
      'mousedown',
      'pointerup',
      'mouseup',
      'contextmenu',
    ]);
  });

  it('uses the right button and its own bitmask bit, which is 2 and not 4', () => {
    const sequence = buildRightClickSequence(at(0, 0));
    const byType = new Map(sequence.map((descriptor) => [descriptor.type, descriptor]));

    expect(byType.get('pointerdown')).toMatchObject({
      button: MouseButton.RIGHT,
      buttons: ButtonsMask.RIGHT,
    });
  });

  it('makes contextmenu bubble and be cancelable, so Foundry can suppress the browser menu', () => {
    const contextmenu = buildRightClickSequence(at(0, 0)).find(
      (descriptor) => descriptor.type === 'contextmenu'
    );

    expect(contextmenu?.bubbles).toBe(true);
    expect(contextmenu?.cancelable).toBe(true);
  });
});

describe('buildDoubleClickSequence', () => {
  it('sends two complete click sequences and then dblclick', () => {
    expect(types(buildDoubleClickSequence(at(0, 0)))).toEqual([
      'pointerdown',
      'mousedown',
      'pointerup',
      'mouseup',
      'click',
      'pointerdown',
      'mousedown',
      'pointerup',
      'mouseup',
      'click',
      'dblclick',
    ]);
  });

  it('increments detail across the pair so the second click is distinguishable', () => {
    const sequence = buildDoubleClickSequence(at(0, 0));
    const clicks = sequence.filter((descriptor) => descriptor.type === 'click');
    const dblclick = sequence.find((descriptor) => descriptor.type === 'dblclick');

    expect(clicks).toHaveLength(2);
    expect(clicks[0]).toHaveProperty('detail', 1);
    expect(clicks[1]).toHaveProperty('detail', 2);
    expect(dblclick).toHaveProperty('detail', 2);
  });
});
