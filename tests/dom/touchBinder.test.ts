import { beforeEach, describe, expect, it } from 'vitest';

import { ExclusionZones } from '../../src/gesture/ExclusionZones.js';
import { TouchBinder } from '../../src/gesture/TouchBinder.js';
import type { GestureInput } from '../../src/gesture/GestureTypes.js';
import { makeTouchEvent } from './support/touchEvents.js';

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('TouchBinder', () => {
  function setup(options: { suppress?: boolean } = {}) {
    const inputs: GestureInput[] = [];
    const binder = new TouchBinder({
      target: document,
      exclusions: new ExclusionZones(),
      onInput: (input) => inputs.push(input),
      suppressNativeTouch: () => options.suppress ?? true,
      now: () => 1000,
    });
    binder.bind();
    return { binder, inputs };
  }

  it('translates a touchstart into a gesture input carrying the finger positions', () => {
    const { binder, inputs } = setup();
    const board = document.createElement('canvas');
    document.body.append(board);

    board.dispatchEvent(
      makeTouchEvent('touchstart', [{ identifier: 3, clientX: 40, clientY: 50 }])
    );

    expect(inputs).toEqual([
      { type: 'touchstart', touches: [{ id: 3, clientX: 40, clientY: 50 }], at: 1000 },
    ]);
    binder.unbind();
  });

  /**
   * Without preventDefault the browser scrolls the page, fires its own synthetic mouse events about
   * 300ms later, and shows text selection handles, all on top of what this module is doing.
   */
  it('cancels the touch so the browser does not scroll or synthesise its own clicks', () => {
    const { binder } = setup();
    const board = document.createElement('canvas');
    document.body.append(board);

    const event = makeTouchEvent('touchstart', [{ identifier: 0, clientX: 1, clientY: 1 }]);
    board.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    binder.unbind();
  });

  it('leaves excluded regions entirely alone, neither cancelling nor reporting them', () => {
    const { binder, inputs } = setup();
    const input = document.createElement('input');
    document.body.append(input);

    const event = makeTouchEvent('touchstart', [{ identifier: 0, clientX: 1, clientY: 1 }]);
    input.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(inputs).toEqual([]);
    binder.unbind();
  });

  it('reports a touchcancel without cancelling it, since there is nothing left to prevent', () => {
    const { binder, inputs } = setup();
    const board = document.createElement('canvas');
    document.body.append(board);

    board.dispatchEvent(makeTouchEvent('touchcancel', []));

    expect(inputs).toEqual([{ type: 'touchcancel', at: 1000 }]);
    binder.unbind();
  });

  it('stops listening after unbind', () => {
    const { binder, inputs } = setup();
    const board = document.createElement('canvas');
    document.body.append(board);
    binder.unbind();

    board.dispatchEvent(makeTouchEvent('touchstart', [{ identifier: 0, clientX: 1, clientY: 1 }]));

    expect(inputs).toEqual([]);
    expect(binder.isBound()).toBe(false);
  });
});
