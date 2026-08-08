import { describe, expect, it } from 'vitest';

import type { EventDescriptor } from '../../src/pointer/EventDescriptor.js';
import { createModifierFlags } from '../../src/pointer/ModifierFlags.js';
import { createPointerState } from '../../src/pointer/PointerState.js';
import { ButtonsMask, MouseButton, NO_BUTTON_CHANGED } from '../../src/pointer/buttons.js';
import {
  buildDoubleClickSequence,
  buildLeftClickSequence,
  buildRightClickSequence,
} from '../../src/pointer/sequences/clickSequence.js';
import {
  buildDragEndSequence,
  buildDragMoveSequence,
  buildDragStartSequence,
} from '../../src/pointer/sequences/dragSequence.js';
import { buildMoveSequence } from '../../src/pointer/sequences/moveSequence.js';
import { buildWheelSequence } from '../../src/pointer/sequences/wheelSequence.js';

/**
 * These run in the node project with no DOM available. If a sequence builder ever reaches for
 * document or window, these tests break immediately rather than passing quietly under jsdom.
 */

const at = (clientX: number, clientY: number) => createPointerState({ clientX, clientY });

const types = (descriptors: readonly EventDescriptor[]): string[] =>
  descriptors.map((descriptor) => descriptor.type);

const targets = (descriptors: readonly EventDescriptor[]): string[] =>
  descriptors.map((descriptor) => descriptor.target);

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

describe('drag sequences', () => {
  it('opens with a press that holds the left button', () => {
    const sequence = buildDragStartSequence(at(0, 0));

    expect(types(sequence)).toEqual(['pointerdown', 'mousedown']);
    expect(sequence[0]).toMatchObject({ button: MouseButton.LEFT, buttons: ButtonsMask.LEFT });
  });

  /**
   * The invariant the whole feature rests on. If buttons drops to zero on the move stream, Foundry
   * reads a hover instead of a drag and token movement, ruler waypoints and template placement all
   * stop working with no error anywhere.
   */
  it('keeps the buttons bitmask set on every step of the move stream', () => {
    for (const step of [1, 2, 3]) {
      const sequence = buildDragMoveSequence(at(step * 10, step * 10));

      expect(types(sequence)).toEqual(['pointermove', 'mousemove']);
      for (const descriptor of sequence) {
        expect(descriptor).toHaveProperty('buttons', ButtonsMask.LEFT);
      }
    }
  });

  it('reports no button changed on drag moves even though a button is held', () => {
    for (const descriptor of buildDragMoveSequence(at(10, 10))) {
      expect(descriptor).toHaveProperty('button', NO_BUTTON_CHANGED);
    }
  });

  it('clears the bitmask on release', () => {
    const sequence = buildDragEndSequence(at(0, 0));

    expect(types(sequence)).toEqual(['pointerup', 'mouseup']);
    for (const descriptor of sequence) {
      expect(descriptor).toHaveProperty('buttons', ButtonsMask.NONE);
    }
  });

  it('does not emit a click on release, which would reselect whatever is under the drop', () => {
    expect(types(buildDragEndSequence(at(0, 0)))).not.toContain('click');
  });

  it('supports dragging with the right button for the canvas pan fallback', () => {
    const sequence = buildDragStartSequence(at(0, 0), MouseButton.RIGHT);
    expect(sequence[0]).toMatchObject({ button: MouseButton.RIGHT, buttons: ButtonsMask.RIGHT });
  });
});

describe('buildWheelSequence', () => {
  it('emits a single pixel mode wheel event at the pointer position', () => {
    const sequence = buildWheelSequence(at(120, 240), -100);

    expect(sequence).toHaveLength(1);
    expect(sequence[0]).toMatchObject({
      kind: 'wheel',
      type: 'wheel',
      deltaY: -100,
      deltaX: 0,
      deltaMode: 0,
      bubbles: true,
      cancelable: true,
      position: { clientX: 120, clientY: 240 },
    });
  });

  it('preserves the sign of the delta rather than normalising it', () => {
    expect(buildWheelSequence(at(0, 0), 100)[0]).toHaveProperty('deltaY', 100);
    expect(buildWheelSequence(at(0, 0), -100)[0]).toHaveProperty('deltaY', -100);
  });
});
