import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildLongPressGuard } from '../../src/foundry/BuildLongPressGuard.ts';

/**
 * Reaching Foundry's MouseInteractionManager CLASS through a live token.
 *
 * ⚠️ The two uncovered lines in this file were the two that matter: resolving `.constructor`, and
 * actually clearing the timer. Everything else here is plumbing around them.
 *
 * `longPressTimeout` is a STATIC. Reading or writing it through an instance finds an own property
 * that shadows the class's, so a guard that reached the instance would look correct, run without
 * error, return happily, and leave Foundry's 500ms timer armed - which then cancels the drag exactly
 * as before. There is no symptom to distinguish that from the guard not existing at all, which is
 * why the instance case is asserted here rather than assumed.
 */
const withCanvas = (manager: unknown) => {
  Object.assign(globalThis, {
    canvas: {
      tokens: { controlled: manager === null ? [] : [{ mouseInteractionManager: manager }] },
    },
  });
};

afterEach(() => {
  Object.assign(globalThis, { canvas: undefined });
});

/**
 * A manager instance whose CONSTRUCTOR carries the static, exactly as Foundry's does.
 *
 * ⚠️ Built from a function rather than a `class`, and that is not a lint workaround. A static IS a
 * property of the constructor function, and writing it this way makes the thing under test visible:
 * `instance.constructor` and the object holding `longPressTimeout` are the same object, and the
 * instance itself has no such property until somebody puts one there.
 */
const managerWithArmedClass = (pending: unknown) => {
  const klass = function MouseInteractionManager() {
    // Constructed via Object.create below, so this body never runs. It exists to be a constructor.
  } as unknown as { prototype: object; longPressTimeout: unknown };
  klass.longPressTimeout = pending;
  return { instance: Object.create(klass.prototype) as object, klass };
};

const fakeWindow = () => {
  const clearTimeout = vi.fn();
  return { win: { clearTimeout } as unknown as Window, clearTimeout };
};

describe('disarming the long press timer', () => {
  it('clears the pending timer and forgets it', () => {
    const { win, clearTimeout } = fakeWindow();
    const { instance, klass } = managerWithArmedClass(1234);
    withCanvas(instance);

    expect(buildLongPressGuard(win).disarm()).toBe(true);

    expect(clearTimeout).toHaveBeenCalledWith(1234);
    expect(klass.longPressTimeout).toBeNull();
  });

  /**
   * ⚠️ THE WHOLE POINT. An own property on the instance shadows the class's static, so a guard that
   * reached the instance would clear a value Foundry never reads and leave the real timer armed. It
   * would report success while changing nothing.
   */
  it('reads the CLASS, not the instance that shadows it', () => {
    const { win, clearTimeout } = fakeWindow();
    const { instance, klass } = managerWithArmedClass(undefined);
    // The instance carries its own, and it is a decoy.
    Object.assign(instance, { longPressTimeout: 999 });
    withCanvas(instance);

    expect(buildLongPressGuard(win).disarm()).toBe(false);

    expect(clearTimeout).not.toHaveBeenCalled();
    expect(klass.longPressTimeout).toBeUndefined();
  });
});

/**
 * ⚠️ Resolved LIVE on every disarm rather than captured once. There is no controlled token before
 * the canvas is up, and the canvas is torn down and rebuilt on every scene change, so a guard that
 * resolved the class at construction would hold a reference to a dead one for the rest of the
 * session and silently stop working after the first scene change.
 */
describe('when there is no token to reach through', () => {
  it.each([
    [
      'no canvas at all',
      () => {
        Object.assign(globalThis, { canvas: undefined });
      },
    ],
    [
      'a canvas with nothing controlled',
      () => {
        withCanvas(null);
      },
    ],
    [
      'a token with no interaction manager',
      () => {
        withCanvas(undefined);
      },
    ],
  ])('reports that it disarmed nothing, given %s', (_case, arrange) => {
    const { win, clearTimeout } = fakeWindow();
    arrange();

    expect(buildLongPressGuard(win).disarm()).toBe(false);
    expect(clearTimeout).not.toHaveBeenCalled();
  });

  it('starts working once a token appears, without being rebuilt', () => {
    const { win } = fakeWindow();
    const guard = buildLongPressGuard(win);
    Object.assign(globalThis, { canvas: undefined });
    expect(guard.disarm()).toBe(false);

    const { instance } = managerWithArmedClass(77);
    withCanvas(instance);

    expect(guard.disarm()).toBe(true);
  });
});
