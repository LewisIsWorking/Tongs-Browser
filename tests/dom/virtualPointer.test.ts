import { describe, expect, it } from 'vitest';

import { ButtonsMask, createPointer, makeRegion, recorded } from './support/pointerHarness.js';

describe('VirtualPointer dragging', () => {
  /**
   * The single most important behaviour in the module. If buttons drops to zero during the move
   * stream, Foundry reads a hover rather than a drag, and token movement, ruler waypoints and
   * template placement all stop working with no error raised anywhere.
   */
  it('keeps the buttons bitmask set through every move of a drag', () => {
    makeRegion('board', 0, 0, 500, 500);
    const pointer = createPointer({ clientX: 10, clientY: 10 });

    pointer.beginDrag();
    pointer.dragBy(20, 0);
    pointer.dragBy(20, 0);
    pointer.dragBy(20, 0);
    pointer.endDrag();

    const moves = recorded.filter((entry) => entry.type === 'pointermove');
    expect(moves).toHaveLength(3);
    expect(moves.every((entry) => entry.buttons === ButtonsMask.LEFT)).toBe(true);

    const down = recorded.find((entry) => entry.type === 'pointerdown');
    const up = recorded.find((entry) => entry.type === 'pointerup');
    expect(down?.buttons).toBe(ButtonsMask.LEFT);
    expect(up?.buttons).toBe(ButtonsMask.NONE);
  });

  /**
   * ⭐ The bug behind "dragging a token does nothing" on a real phone, and the reason it never
   * showed up here or on a desktop.
   *
   * Every event of a drag has to keep going to the element that received the press, exactly as a
   * browser's implicit pointer capture does. This used to hit test afresh on every move, so the
   * instant the pointer crossed anything else, a chat window, the modifier bar, a character sheet,
   * the drag was delivered THERE and the canvas simply stopped hearing about it.
   *
   * A drag across empty canvas never crosses anything, which is why desktop passed every time. The
   * device report named it outright: `pointermove buttons=1 -> div#` where `canvas#board` was needed.
   */
  it('keeps sending the whole drag to the element the press landed on', () => {
    makeRegion('board', 0, 0, 200, 500);
    makeRegion('panel', 200, 0, 300, 500);
    const pointer = createPointer({ clientX: 50, clientY: 50 });

    pointer.beginDrag();
    // Straight across the boundary and well into the panel.
    pointer.dragBy(120, 0);
    pointer.dragBy(120, 0);
    pointer.endDrag();

    const dragEvents = recorded.filter(
      (entry) => entry.type === 'pointermove' || entry.type === 'pointerup'
    );
    expect(dragEvents.length).toBeGreaterThan(0);
    expect(dragEvents.every((entry) => entry.target === 'board')).toBe(true);
    // And nothing leaked into the element the pointer merely passed over.
    expect(recorded.some((entry) => entry.target === 'panel')).toBe(false);
  });

  /**
   * The capture is released afterwards, or the NEXT drag would be delivered to wherever the last one
   * happened to start, which is a more confusing bug than the one being fixed.
   */
  it('captures the new element on a second drag rather than reusing the first', () => {
    makeRegion('board', 0, 0, 200, 500);
    makeRegion('panel', 200, 0, 300, 500);
    const pointer = createPointer({ clientX: 50, clientY: 50 });

    pointer.beginDrag();
    pointer.dragBy(20, 0);
    pointer.endDrag();

    pointer.moveTo({ clientX: 300, clientY: 50 });
    recorded.length = 0;
    pointer.beginDrag();
    pointer.dragBy(20, 0);
    pointer.endDrag();

    const moves = recorded.filter((entry) => entry.type === 'pointermove');
    expect(moves.length).toBeGreaterThan(0);
    expect(moves.every((entry) => entry.target === 'panel')).toBe(true);
  });

  it('advances the pointer position across the drag', () => {
    makeRegion('board', 0, 0, 500, 500);
    const pointer = createPointer({ clientX: 10, clientY: 10 });

    pointer.beginDrag();
    pointer.dragBy(20, 5);
    pointer.dragBy(20, 5);

    const moves = recorded.filter((entry) => entry.type === 'pointermove');
    expect(moves.map((entry) => `${String(entry.clientX)},${String(entry.clientY)}`)).toEqual([
      '30,15',
      '50,20',
    ]);
    expect(pointer.getPosition()).toEqual({ clientX: 50, clientY: 20 });
  });

  it('does not emit a click on release, which would reselect whatever is under the drop', () => {
    makeRegion('board', 0, 0, 500, 500);
    const pointer = createPointer({ clientX: 10, clientY: 10 });

    pointer.beginDrag();
    pointer.dragBy(50, 50);
    pointer.endDrag();

    expect(recorded.map((entry) => entry.type)).not.toContain('click');
  });

  it('ignores drag moves when no drag is in progress', () => {
    makeRegion('board', 0, 0, 500, 500);
    const pointer = createPointer({ clientX: 10, clientY: 10 });

    pointer.dragBy(50, 50);

    expect(recorded).toHaveLength(0);
    expect(pointer.isDragging()).toBe(false);
  });

  it('emits pointercancel when a drag is abandoned, so Foundry releases its drag state', () => {
    makeRegion('board', 0, 0, 500, 500);
    const pointer = createPointer({ clientX: 10, clientY: 10 });

    pointer.beginDrag();
    recorded.length = 0;
    pointer.cancelDrag();

    expect(recorded.map((entry) => entry.type)).toEqual(['pointercancel']);
    expect(pointer.isDragging()).toBe(false);
  });

  /**
   * ⛔ This assertion used to be the exact opposite, demanding the target be resolved afresh on every
   * drag step, and it was the bug written down as a requirement.
   *
   * The reasoning behind it was sound and is preserved below: Foundry re-renders applications mid
   * interaction, so an element captured earlier can be detached, and dispatching at a detached
   * element throws the event away silently. The mistake was treating "it might be detached" as a
   * reason to re-resolve ALWAYS rather than only when it actually is.
   */
  it('falls back to a fresh hit test only when the captured element is detached', () => {
    const a = makeRegion('a', 0, 0, 100, 100);
    makeRegion('b', 100, 0, 100, 100);
    const pointer = createPointer({ clientX: 50, clientY: 50 });

    pointer.beginDrag();
    // Foundry tearing down and rebuilding an application mid drag.
    a.remove();
    pointer.dragBy(100, 0);

    const moves = recorded.filter((entry) => entry.type === 'pointermove');
    expect(moves.map((entry) => entry.target)).toEqual(['b']);
  });
});
