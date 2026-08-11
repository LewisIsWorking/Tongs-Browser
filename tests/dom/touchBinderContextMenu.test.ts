import { afterEach, describe, expect, it } from 'vitest';

import { ExclusionZones } from '../../src/gesture/ExclusionZones.js';
import { TouchBinder } from '../../src/gesture/TouchBinder.js';

/**
 * The browser's own `contextmenu` cancels every drag, and this is where it gets stopped.
 *
 * Read out of Foundry's `client/canvas/interaction/mouse-handler.mjs`, where MouseInteractionManager
 * builds its handler map:
 *
 *     contextmenu: this.#handleDragCancel.bind(this)
 *
 * So a `contextmenu` aborts an in progress drag outright, and `_onDragLeftCancel` writes nothing. The
 * token stays put while every other measurement looks healthy: the gate opens, the state reaches
 * DRAG, a preview clone appears, and the whole thing is discarded. A device reported exactly that,
 * three cancels and not one drop.
 *
 * On a phone a long press produces a native `contextmenu`, and a finger dwelling mid drag is not an
 * edge case, it is how people drag. A mouse only produces one on a deliberate right click, which is
 * why no desktop run ever saw it.
 *
 * ⭐ `isTrusted` is the whole discrimination: the browser's event is trusted, the one this module
 * synthesises for its long press gesture is not. The first must die, the second must live.
 */
const cleanups: (() => void)[] = [];

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) {
    cleanup();
  }
  document.body.innerHTML = '';
});

function contextMenuEvent(trusted: boolean) {
  const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
  if (trusted) {
    throw new Error('a trusted event cannot be dispatched in jsdom; use fakeContextMenu instead');
  }
  return event;
}

/**
 * A trusted event, for the decision rather than the dispatch.
 *
 * ⚠️ jsdom defines `isTrusted` as a non configurable OWN property, so it can be neither redefined nor
 * shadowed, and nothing dispatched inside jsdom can ever be trusted. That is correct of jsdom and it
 * makes the central claim here undispatchable: only a real browser produces the event this guard
 * exists to stop.
 *
 * So the guard's DECISION is tested by handing it the event shape directly, which is the part that
 * can be wrong, and the binding is tested separately by dispatching. Pretending a dispatched jsdom
 * event were trusted would be testing the fake rather than the code.
 */
function fakeContextMenu(trusted: boolean, target: EventTarget) {
  let prevented = false;
  let stopped = false;
  const event = {
    isTrusted: trusted,
    target,
    preventDefault: () => {
      prevented = true;
    },
    stopPropagation: () => {
      stopped = true;
    },
  };
  return { event, wasPrevented: () => prevented, wasStopped: () => stopped };
}

function callGuard(binder: TouchBinder, event: unknown): void {
  (binder as unknown as { onNativeContextMenu: (e: unknown) => void }).onNativeContextMenu(event);
}

function bind(suppress = true) {
  const binder = new TouchBinder({
    target: document,
    exclusions: new ExclusionZones({}),
    onInput: () => undefined,
    suppressNativeTouch: () => suppress,
    now: () => 0,
  });
  binder.bind();
  cleanups.push(() => {
    binder.unbind();
  });

  // Stands in for Foundry, which listens through PIXI on the canvas.
  const reachedFoundry: string[] = [];
  const board = document.createElement('canvas');
  board.id = 'board';
  document.body.append(board);
  board.addEventListener('contextmenu', (event) => reachedFoundry.push(event.type));

  return { reachedFoundry, board, binder };
}

describe('TouchBinder and the drag cancelling contextmenu', () => {
  it("stops the browser's own contextmenu, and prevents the platform menu with it", () => {
    const { board, binder } = bind();
    const { event, wasPrevented, wasStopped } = fakeContextMenu(true, board);

    callGuard(binder, event);

    // Stopped, so Foundry never sees it and cannot cancel the drag.
    expect(wasStopped()).toBe(true);
    // Prevented, so the platform's own long press menu does not appear over the map either.
    expect(wasPrevented()).toBe(true);
  });

  it("leaves the module's own synthesised contextmenu completely alone", () => {
    const { board, binder } = bind();
    const { event, wasPrevented, wasStopped } = fakeContextMenu(false, board);

    callGuard(binder, event);

    expect(wasStopped()).toBe(false);
    expect(wasPrevented()).toBe(false);
  });

  it('leaves a trusted contextmenu alone when suppression is off', () => {
    const { board, binder } = bind(false);
    const { event, wasStopped } = fakeContextMenu(true, board);

    callGuard(binder, event);

    expect(wasStopped()).toBe(false);
  });

  it('leaves a trusted contextmenu alone inside an excluded region', () => {
    const excluded = document.createElement('div');
    excluded.setAttribute('data-tongs-browser', 'ignore');
    document.body.append(excluded);
    const { binder } = bind();
    const { event, wasStopped } = fakeContextMenu(true, excluded);

    callGuard(binder, event);

    expect(wasStopped()).toBe(false);
  });

  /**
   * The module's own long press right click MUST still work. Suppressing every contextmenu would
   * trade a broken drag for a broken right click, which is the gesture the whole trackpad model
   * exists to provide on a device with no second mouse button.
   */
  it("lets the module's own synthesised contextmenu through", () => {
    const { reachedFoundry, board } = bind();

    board.dispatchEvent(contextMenuEvent(false));

    expect(reachedFoundry).toEqual(['contextmenu']);
  });
});
