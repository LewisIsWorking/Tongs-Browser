import { describe, expect, it } from 'vitest';

import {
  ButtonsMask,
  NO_BUTTON_CHANGED,
  at,
  buildMoveSequence,
  createModifierFlags,
  createPointerState,
  targets,
  types,
} from './support/sequenceHarness.js';

describe('buildMoveSequence', () => {
  const options = { targetChanged: false, hasPreviousTarget: true, hasCurrentTarget: true };

  it('emits only the move pair when the target has not changed', () => {
    expect(types(buildMoveSequence(at(10, 10), options))).toEqual(['pointermove', 'mousemove']);
  });

  it('emits leave then enter then move when the target changes', () => {
    const sequence = buildMoveSequence(at(10, 10), { ...options, targetChanged: true });

    expect(types(sequence)).toEqual([
      'pointerout',
      'pointerleave',
      'mouseout',
      'mouseleave',
      'pointerover',
      'pointerenter',
      'mouseover',
      'mouseenter',
      'pointermove',
      'mousemove',
    ]);
  });

  it('aims the leaving events at the previous element and the rest at the current one', () => {
    const sequence = buildMoveSequence(at(10, 10), { ...options, targetChanged: true });

    expect(targets(sequence)).toEqual([
      'previous',
      'previous',
      'previous',
      'previous',
      'current',
      'current',
      'current',
      'current',
      'current',
      'current',
    ]);
  });

  it('skips the leaving half on the very first move, when there is no previous element', () => {
    const sequence = buildMoveSequence(at(10, 10), {
      targetChanged: true,
      hasPreviousTarget: false,
      hasCurrentTarget: true,
    });

    expect(types(sequence)).toEqual([
      'pointerover',
      'pointerenter',
      'mouseover',
      'mouseenter',
      'pointermove',
      'mousemove',
    ]);
  });

  it('emits only the leaving half when moving onto nothing', () => {
    const sequence = buildMoveSequence(at(10, 10), {
      targetChanged: true,
      hasPreviousTarget: true,
      hasCurrentTarget: false,
    });

    expect(types(sequence)).toEqual(['pointerout', 'pointerleave', 'mouseout', 'mouseleave']);
  });

  it('marks enter and leave as non bubbling, so container listeners are not spammed', () => {
    const sequence = buildMoveSequence(at(10, 10), { ...options, targetChanged: true });
    const byType = new Map(sequence.map((descriptor) => [descriptor.type, descriptor]));

    expect(byType.get('pointerleave')?.bubbles).toBe(false);
    expect(byType.get('mouseleave')?.bubbles).toBe(false);
    expect(byType.get('pointerenter')?.bubbles).toBe(false);
    expect(byType.get('mouseenter')?.bubbles).toBe(false);

    expect(byType.get('pointerout')?.bubbles).toBe(true);
    expect(byType.get('pointerover')?.bubbles).toBe(true);
    expect(byType.get('pointermove')?.bubbles).toBe(true);
  });

  it('reports no button changed on a move, rather than zero which would mean the left button', () => {
    const sequence = buildMoveSequence(at(10, 10), options);

    for (const descriptor of sequence) {
      expect(descriptor).toHaveProperty('button', NO_BUTTON_CHANGED);
    }
  });

  it('carries the modifier flags onto every descriptor', () => {
    const state = createPointerState(
      { clientX: 5, clientY: 5 },
      ButtonsMask.NONE,
      createModifierFlags({ shiftKey: true, ctrlKey: true })
    );
    const sequence = buildMoveSequence(state, { ...options, targetChanged: true });

    expect(sequence.every((descriptor) => descriptor.modifiers.shiftKey)).toBe(true);
    expect(sequence.every((descriptor) => descriptor.modifiers.ctrlKey)).toBe(true);
    expect(sequence.every((descriptor) => descriptor.modifiers.altKey)).toBe(false);
  });
});
