import { describe, expect, it } from 'vitest';

import {
  ButtonsMask,
  MouseButton,
  NO_BUTTON_CHANGED,
  at,
  buildDragEndSequence,
  buildDragMoveSequence,
  buildDragStartSequence,
  buildWheelSequence,
  types,
} from './support/sequenceHarness.js';

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
