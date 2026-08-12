import { describe, expect, it, vi } from 'vitest';

import { DragCapture } from '../../src/pointer/DragCapture.js';

/**
 * Which element owns an in progress drag: the browser's implicit pointer capture, reimplemented,
 * because a synthesised pointer does not get it for free.
 */
const element = (isConnected: boolean, id = 'e') => ({ isConnected, id }) as unknown as Element;

describe('DragCapture', () => {
  /**
   * ⚠️ The bug behind "dragging a token does nothing" on a real phone.
   *
   * VirtualPointer used to hit test afresh on every step. A browser does NOT do that: pointerdown
   * implicitly CAPTURES the pointer to the element that received it, and every later move and the up
   * go to that same element however far the pointer travels. Re-resolving means the moment the
   * pointer crosses a chat window, the modifier bar or a sheet, the drag events go THERE and the
   * canvas stops hearing about the drag.
   *
   * Measured on a device: `pointermove buttons=1 -> div#`, when it needed to reach `canvas#board`.
   * Never seen on desktop, because a drag across empty canvas never crosses anything.
   */
  it('keeps delivering to the element that received the press, never re-resolving', () => {
    const board = element(true, 'board');
    const chat = element(true, 'chat');
    const capture = new DragCapture();
    capture.claim(board);

    const fallback = vi.fn(() => chat);

    expect(capture.resolve(fallback)).toBe(board);
    expect(capture.resolve(fallback)).toBe(board);
    expect(fallback).not.toHaveBeenCalled();
  });

  /**
   * ⚠️ The original reason for re-resolving was real and is preserved. Foundry re-renders
   * applications mid interaction, so a captured element can be DETACHED, and dispatching at a
   * detached element throws the event away silently: no error, no warning, and a drag that stops.
   */
  it('falls back the moment the captured element leaves the document', () => {
    const detached = element(false, 'gone');
    const replacement = element(true, 'board');
    const capture = new DragCapture();
    capture.claim(detached);

    expect(capture.resolve(() => replacement)).toBe(replacement);
  });

  it('adopts the replacement, so the fallback runs once rather than every step', () => {
    const replacement = element(true, 'board');
    const capture = new DragCapture();
    capture.claim(element(false));

    const fallback = vi.fn(() => replacement);
    capture.resolve(fallback);
    capture.resolve(fallback);

    expect(fallback).toHaveBeenCalledOnce();
  });

  it('uses the fallback when nothing was ever captured', () => {
    const board = element(true, 'board');

    expect(new DragCapture().resolve(() => board)).toBe(board);
  });

  it('copes with a press that landed on nothing at all', () => {
    const capture = new DragCapture();
    capture.claim(null);

    expect(capture.resolve(() => null)).toBeNull();
  });

  /** A capture that outlived its drag would deliver the next gesture to the previous target. */
  it('releases, so the next drag does not inherit this one', () => {
    const board = element(true, 'board');
    const other = element(true, 'other');
    const capture = new DragCapture();
    capture.claim(board);
    capture.release();

    expect(capture.resolve(() => other)).toBe(other);
  });
});
