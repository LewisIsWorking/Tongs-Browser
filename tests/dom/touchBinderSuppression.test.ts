import { beforeEach, describe, expect, it } from 'vitest';

import { VIRTUAL_POINTER_ID } from '../../src/constants.js';
import { ExclusionZones } from '../../src/gesture/ExclusionZones.js';
import { TouchBinder } from '../../src/gesture/TouchBinder.js';
import type { GestureInput } from '../../src/gesture/GestureTypes.js';

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('TouchBinder native pointer suppression', () => {
  function dispatchNativePointer(pointerId: number, pointerType: string, target: Element): boolean {
    let reached = false;
    const listener = (): void => {
      reached = true;
    };
    document.body.addEventListener('pointerdown', listener);
    target.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId, pointerType })
    );
    document.body.removeEventListener('pointerdown', listener);
    return reached;
  }

  it('stops a real touch derived pointer event from reaching Foundry', () => {
    const inputs: GestureInput[] = [];
    const binder = new TouchBinder({
      target: document,
      exclusions: new ExclusionZones(),
      onInput: (input) => inputs.push(input),
      suppressNativeTouch: () => true,
      now: () => 0,
    });
    binder.bind();

    const board = document.createElement('canvas');
    document.body.append(board);

    expect(dispatchNativePointer(1, 'touch', board)).toBe(false);
    binder.unbind();
  });

  it('lets our own synthesised pointer through, identified by the reserved id', () => {
    const binder = new TouchBinder({
      target: document,
      exclusions: new ExclusionZones(),
      onInput: () => undefined,
      suppressNativeTouch: () => true,
      now: () => 0,
    });
    binder.bind();

    const board = document.createElement('canvas');
    document.body.append(board);

    expect(dispatchNativePointer(VIRTUAL_POINTER_ID, 'mouse', board)).toBe(true);
    binder.unbind();
  });

  it('leaves a real mouse alone, so a plugged in mouse still works', () => {
    const binder = new TouchBinder({
      target: document,
      exclusions: new ExclusionZones(),
      onInput: () => undefined,
      suppressNativeTouch: () => true,
      now: () => 0,
    });
    binder.bind();

    const board = document.createElement('canvas');
    document.body.append(board);

    expect(dispatchNativePointer(1, 'mouse', board)).toBe(true);
    binder.unbind();
  });

  it('suppresses nothing when the setting is off, so a conflicting module can take over', () => {
    const binder = new TouchBinder({
      target: document,
      exclusions: new ExclusionZones(),
      onInput: () => undefined,
      suppressNativeTouch: () => false,
      now: () => 0,
    });
    binder.bind();

    const board = document.createElement('canvas');
    document.body.append(board);

    expect(dispatchNativePointer(1, 'touch', board)).toBe(true);
    binder.unbind();
  });
});
