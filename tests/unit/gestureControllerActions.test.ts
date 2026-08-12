import { describe, expect, it, vi } from 'vitest';

import { GestureController } from '../../src/gesture/GestureController.js';
import type { CanvasController } from '../../src/gesture/CanvasController.js';
import type { GestureAction } from '../../src/gesture/GestureTypes.js';
import type { VirtualPointer } from '../../src/pointer/VirtualPointer.js';

/**
 * Running what the machine decided, and saying so when an action is refused. Extracted from
 * gestureControllerDrag 2026-08-12.
 *
 * The machine choosing the actions is tested thoroughly elsewhere. What these ask is whether the
 * class that CARRIES THEM OUT actually carries out all of them, which is the half that went
 * untested.
 */
describe('GestureController actions and configuration', () => {
  it('exposes its machine and accepts config updates', () => {
    const controller = new GestureController({
      pointer: { isDragging: () => false } as unknown as VirtualPointer,
      canvas: {} as unknown as CanvasController,
      config: { longPressMs: 400 },
    });

    expect(controller.getMachine()).toBeDefined();
    expect(() => {
      controller.updateConfig({ longPressMs: 700 });
    }).not.toThrow();
  });

  /** handleInput is the real entry point, and it must run every action the machine returns. */
  it('performs every action the machine returns for one input', () => {
    const calls: string[] = [];
    const machine = {
      handle: () => ({ actions: [{ type: 'beginDrag' }, { type: 'endDrag' }] }),
      reset: () => undefined,
      updateConfig: () => undefined,
    };

    new GestureController({
      pointer: {
        isDragging: () => false,
        beginDrag: () => calls.push('beginDrag'),
        endDrag: () => calls.push('endDrag'),
      } as unknown as VirtualPointer,
      canvas: {} as unknown as CanvasController,
      machine: machine as never,
    }).handleInput({ type: 'touchend', at: 1, touches: [] } as never);

    expect(calls).toEqual(['beginDrag', 'endDrag']);
  });

  it('says why it ignored the click, rather than dropping it silently', () => {
    const debug = vi.fn();
    const pointer = {
      isDragging: () => true,
      leftClick: () => undefined,
    } as unknown as VirtualPointer;
    const controller = new GestureController({
      pointer,
      canvas: {} as unknown as CanvasController,
      logger: { debug } as never,
    });

    (controller as unknown as { perform: (a: GestureAction) => void }).perform({
      type: 'leftClick',
    });

    expect(debug).toHaveBeenCalledOnce();
    expect(String(debug.mock.calls[0]?.[0])).toContain('grab');
  });
});
