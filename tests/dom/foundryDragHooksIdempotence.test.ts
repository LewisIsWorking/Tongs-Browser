import { describe, expect, it } from 'vitest';

import { installFoundryDragHooks } from '../../src/debug/FoundryDragHooks.js';

/**
 * Installing the observers more than once must not stack them. Written 2026-08-13.
 *
 * ⚠️ THE BUG THIS PINS, measured on a device against build 0.25.52:
 *
 *   _onDragLeftStart [...] then _onDragLeftStart [...] then   (x ~150)
 *   token.draw DURING THE DRAG ... then token.draw ...        (x ~150)
 *
 * for a single drag that had exactly ONE of each. `DragRecorder.recordDispatch` calls
 * `observers.attach()` on every dispatched event, and `DragObservers.hookDragEndings` only stopped
 * retrying once BOTH hooks were installed. The manager hook needs a controlled token, so before a
 * token is selected it never installs - and the token prototype was re-wrapped on every event,
 * forever, each layer announcing itself before delegating to the one beneath.
 *
 * The report was therefore not merely noisy but WRONG: it described violent churn that never
 * happened, and the churn was the leading explanation for a drag that had in fact succeeded.
 *
 * It was also a real cost in a live game. Every token redraw in that session ran through ~150 stack
 * frames belonging to a diagnostic whose own docblock promises it "observes Foundry without changing
 * it". The wrapper depth grew without bound for as long as the tab stayed open.
 *
 * ⚠️ Assert on the OBSERVATION COUNT, not on identity of the wrapper. Checking that
 * `prototype.draw` is unchanged after a second install would pass just as happily if the second
 * install had replaced the wrapper with a fresh one that dropped the first - which loses
 * observations rather than duplicating them, and is just as wrong.
 */
function prototypeWithMethods(names: readonly string[]) {
  const prototype: Record<string, unknown> = {};
  for (const name of names) {
    prototype[name] = function original() {
      return `${name}-result`;
    };
  }
  return prototype;
}

const TOKEN_METHODS = [
  'draw',
  'destroy',
  '_onDragLeftStart',
  '_onDragLeftDrop',
  '_onDragLeftCancel',
];

const call = (prototype: Record<string, unknown>, name: string, self: unknown) =>
  (prototype[name] as (this: unknown, ...args: unknown[]) => unknown).call(self);

describe('installing the drag observers repeatedly', () => {
  it('announces one real call once, however many times it was installed', () => {
    const observations: string[] = [];
    const token = prototypeWithMethods(TOKEN_METHODS);
    const manager = prototypeWithMethods(['cancel', 'reset']);
    const options = {
      getTokenPrototype: () => token,
      getManagerPrototype: () => manager,
      isRecording: () => true,
      onObservation: (note: string) => observations.push(note),
    };

    for (let attempt = 0; attempt < 50; attempt += 1) {
      installFoundryDragHooks(options);
    }

    call(token, '_onDragLeftStart', {});
    call(token, 'draw', { mouseInteractionManager: { state: 4 } });
    call(manager, 'cancel', { state: 4 });

    expect(observations).toHaveLength(3);
  });

  /**
   * ⚠️ The EXACT device sequence: the manager is unreachable until a token is controlled, so the
   * caller keeps retrying, and every retry used to re-wrap the token prototype that was already
   * fine. This is the case a single "install twice" test would not have covered, because the
   * returned flags differ between the two calls and it is the flags the caller loops on.
   */
  it('does not re-wrap the token while it waits for the manager to appear', () => {
    const observations: string[] = [];
    const token = prototypeWithMethods(TOKEN_METHODS);
    const manager = prototypeWithMethods(['cancel', 'reset']);
    let managerReachable = false;

    const options = {
      getTokenPrototype: () => token,
      getManagerPrototype: () => (managerReachable ? manager : undefined),
      isRecording: () => true,
      onObservation: (note: string) => observations.push(note),
    };

    for (let attempt = 0; attempt < 20; attempt += 1) {
      expect(installFoundryDragHooks(options)).toEqual({ token: true, manager: false });
    }

    managerReachable = true;
    expect(installFoundryDragHooks(options)).toEqual({ token: true, manager: true });

    call(token, 'draw', { mouseInteractionManager: { state: 3 } });
    call(manager, 'cancel', { state: 3 });

    expect(observations).toEqual([
      'token.draw at GRABBED, which CANCELLED THE INTERACTION',
      expect.stringContaining('manager.cancel at GRABBED'),
    ]);
  });

  /** Wrapping once must not mean wrapping none: the observation still has to arrive. */
  it('still observes, so idempotence has not silently disabled the probe', () => {
    const observations: string[] = [];
    const token = prototypeWithMethods(TOKEN_METHODS);

    const options = {
      getTokenPrototype: () => token,
      getManagerPrototype: () => undefined,
      isRecording: () => true,
      onObservation: (note: string) => observations.push(note),
    };

    installFoundryDragHooks(options);
    installFoundryDragHooks(options);

    expect(call(token, '_onDragLeftDrop', {})).toBe('_onDragLeftDrop-result');
    expect(observations).toEqual(['_onDragLeftDrop [no event, Foundry did it itself]']);
  });
});
