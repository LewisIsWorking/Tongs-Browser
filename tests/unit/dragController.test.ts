import { describe, expect, it, vi } from 'vitest';

import { DragController, type DragPort } from '../../src/pointer/DragController.js';
import { MouseButton } from '../../src/pointer/buttons.js';
import type { EventDescriptor } from '../../src/pointer/EventDescriptor.js';

/**
 * Holding a button down across a gesture.
 *
 * The three parts move as one: whether a button is held, WHICH button, and which element owns the
 * gesture. Splitting them is how a drag ends up half released, with Foundry still believing a button
 * is down and a token stuck to the pointer.
 */
const element = (id: string, isConnected = true) => ({ id, isConnected }) as unknown as Element;
const SEQUENCE = [{ type: 'pointerdown' }] as unknown as readonly EventDescriptor[];

const port = (overrides: Partial<DragPort> = {}) => {
  const pressed = element('board');
  return {
    dispatchAt: vi.fn(),
    dispatchHere: vi.fn(),
    lastTarget: () => pressed,
    hitTestHere: () => element('elsewhere'),
    setButtonHeld: vi.fn(),
    ...overrides,
  } satisfies DragPort;
};

describe('beginning a drag', () => {
  it('holds the button and sends the press at the pointer', () => {
    const p = port();
    const controller = new DragController(p);

    controller.begin(MouseButton.LEFT, () => SEQUENCE);

    expect(controller.isDragging()).toBe(true);
    expect(p.setButtonHeld).toHaveBeenCalledWith(true);
    expect(p.dispatchHere).toHaveBeenCalledWith(SEQUENCE);
  });

  it('remembers which button is held, not just that one is', () => {
    const controller = new DragController(port());

    controller.begin(MouseButton.RIGHT, () => SEQUENCE);

    expect(controller.heldButton()).toBe(MouseButton.RIGHT);
  });

  /**
   * ⚠️ Claimed AFTER the press has been dispatched, because the press is what resolves the element.
   * Claiming before would capture whatever the previous gesture left behind.
   */
  it('captures the element the press landed on', () => {
    const pressed = element('board');
    const controller = new DragController(port({ lastTarget: () => pressed }));

    controller.begin(MouseButton.LEFT, () => SEQUENCE);

    expect(controller.resolveTarget()).toBe(pressed);
  });

  it('ignores a second begin, so a held drag is not restarted', () => {
    const p = port();
    const controller = new DragController(p);

    controller.begin(MouseButton.LEFT, () => SEQUENCE);
    controller.begin(MouseButton.RIGHT, () => SEQUENCE);

    expect(p.dispatchHere).toHaveBeenCalledOnce();
    expect(controller.heldButton()).toBe(MouseButton.LEFT);
  });
});

describe('moving during a drag', () => {
  /**
   * ⚠️ While a button is held, ANY movement is a drag, however it arrived. The buttons bitmask has
   * to stay set on every move between the down and the up, or Foundry reads the stream as a hover
   * and nothing follows the pointer.
   */
  it('sends the move to the captured element and reports that it handled it', () => {
    const pressed = element('board');
    const p = port({ lastTarget: () => pressed });
    const controller = new DragController(p);
    controller.begin(MouseButton.LEFT, () => SEQUENCE);

    expect(controller.moveStep(SEQUENCE)).toBe(true);
    expect(p.dispatchAt).toHaveBeenCalledWith(SEQUENCE, pressed);
  });

  /** Declining lets the caller fall through to ordinary hover handling. */
  it('declines when no drag is in progress, sending nothing', () => {
    const p = port();
    const controller = new DragController(p);

    expect(controller.moveStep(SEQUENCE)).toBe(false);
    expect(p.dispatchAt).not.toHaveBeenCalled();
  });
});

describe('finishing a drag', () => {
  /**
   * ⚠️ The target is resolved BEFORE the flag is cleared. Resolving after would take the fallback
   * path on a detached capture and hit test at the pointer, which by then is wherever the drag ended
   * rather than on whatever received the press.
   */
  it('releases at the element that received the press, not where the drag ended', () => {
    const pressed = element('board');
    const elsewhere = element('chat');
    const p = port({ lastTarget: () => pressed, hitTestHere: () => elsewhere });
    const controller = new DragController(p);
    controller.begin(MouseButton.LEFT, () => SEQUENCE);

    controller.finish(SEQUENCE);

    expect(p.dispatchAt).toHaveBeenCalledWith(SEQUENCE, pressed);
    expect(controller.isDragging()).toBe(false);
    expect(p.setButtonHeld).toHaveBeenLastCalledWith(false);
  });

  it('does nothing at all when no drag is in progress', () => {
    const p = port();
    const controller = new DragController(p);

    controller.finish(SEQUENCE);

    expect(p.dispatchAt).not.toHaveBeenCalled();
    expect(p.setButtonHeld).not.toHaveBeenCalled();
  });

  /** A capture that outlived its drag would deliver the next gesture to the previous target. */
  it('releases the capture, so the next drag does not inherit it', () => {
    const first = element('board');
    const fallback = element('elsewhere');
    const controller = new DragController(
      port({ lastTarget: () => first, hitTestHere: () => fallback })
    );
    controller.begin(MouseButton.LEFT, () => SEQUENCE);
    controller.finish(SEQUENCE);

    expect(controller.resolveTarget()).toBe(fallback);
  });

  it('ignores a second finish', () => {
    const p = port();
    const controller = new DragController(p);
    controller.begin(MouseButton.LEFT, () => SEQUENCE);

    controller.finish(SEQUENCE);
    controller.finish(SEQUENCE);

    expect(p.dispatchAt).toHaveBeenCalledOnce();
  });
});

describe('a detached capture', () => {
  /**
   * Foundry re-renders applications mid interaction, so a captured element can be detached, and
   * dispatching at a detached element throws the event away silently.
   */
  it('falls back to a hit test when the captured element has left the document', () => {
    const detached = element('gone', false);
    const replacement = element('board');
    const controller = new DragController(
      port({ lastTarget: () => detached, hitTestHere: () => replacement })
    );
    controller.begin(MouseButton.LEFT, () => SEQUENCE);

    expect(controller.resolveTarget()).toBe(replacement);
  });
});
