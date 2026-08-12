import { describe, expect, it } from 'vitest';

import { installFoundryDragHooks, summariseDragEndings } from '../../src/debug/FoundryDragHooks.js';

/**
 * The observers that watch how Foundry ends a token drag.
 *
 * Two properties matter more than the reporting, and both are load bearing inside a live game:
 *
 * 1. The wraps must not CHANGE anything. The original is called with the original `this` and its
 *    result returned untouched. A probe that alters what it measures is worse than no probe.
 * 2. They must survive a Foundry that is not ready yet, since the canvas does not exist when the
 *    module is constructed and the manager prototype is only reachable through a live token.
 */
function prototypeWithMethods(names: readonly string[]) {
  const calls: { name: string; args: unknown[]; self: unknown }[] = [];
  const prototype: Record<string, unknown> = {};
  for (const name of names) {
    prototype[name] = function original(this: unknown, ...args: unknown[]) {
      calls.push({ name, args, self: this });
      return `${name}-result`;
    };
  }
  return { prototype, calls };
}

function install(overrides: Partial<Parameters<typeof installFoundryDragHooks>[0]> = {}) {
  const observations: string[] = [];
  const token = prototypeWithMethods([
    'draw',
    'destroy',
    '_onDragLeftStart',
    '_onDragLeftDrop',
    '_onDragLeftCancel',
  ]);
  const manager = prototypeWithMethods(['cancel', 'reset']);

  const installed = installFoundryDragHooks({
    getTokenPrototype: () => token.prototype,
    getManagerPrototype: () => manager.prototype,
    isRecording: () => true,
    onObservation: (note) => observations.push(note),
    ...overrides,
  });

  return { installed, observations, token, manager };
}

const call = (prototype: Record<string, unknown>, name: string, self: unknown, arg?: unknown) =>
  (prototype[name] as (this: unknown, ...args: unknown[]) => unknown).call(self, arg);

describe('installFoundryDragHooks', () => {
  it('reports the manager state and the causing event for a cancel', () => {
    const { observations, manager } = install();

    call(manager.prototype, 'cancel', { state: 3 }, { type: 'contextmenu', button: 2 });

    /*
     * ⚠️ The call site is matched loosely on purpose. WHICH frame appears depends on the runtime,
     * and pinning the exact string would make this a test of Node's stack format. What matters, and
     * what is asserted, is that the state and the causing event are still named and that a caller is
     * reported at all: three of Foundry's cancel paths are indistinguishable without one.
     */
    expect(observations).toHaveLength(1);
    expect(observations[0]).toMatch(
      /^manager\.cancel at GRABBED via .+ \[contextmenu button=2 n\/a\]$/
    );
  });

  /**
   * A cancel Foundry performs itself, with no event, is a genuinely different finding from one
   * caused by input, and it moves the search from this module into Foundry.
   */
  it('says plainly when Foundry cancelled with no event at all', () => {
    const { observations, manager } = install();

    call(manager.prototype, 'reset', { state: 4 });

    expect(observations).toEqual(['manager.reset at DRAG [no event, Foundry did it itself]']);
  });

  it('names an unrecognised state rather than printing undefined', () => {
    const { observations, manager } = install();

    call(manager.prototype, 'cancel', { state: 99 });

    expect(observations[0]).toContain('at 99');
  });

  /** Redrawing a token cancels its interaction, so a redraw mid drag is the finding. */
  it('records a redraw that lands during a drag', () => {
    const { observations, token } = install();

    call(token.prototype, 'draw', {});
    call(token.prototype, 'destroy', {});

    expect(observations).toEqual([
      'token.draw DURING THE DRAG (this cancels the interaction)',
      'token.destroy DURING THE DRAG (this cancels the interaction)',
    ]);
  });

  /** Foundry redraws constantly. Only the ones inside a gesture are evidence of anything. */
  it('ignores redraws outside a drag', () => {
    const { observations, token } = install({ isRecording: () => false });

    call(token.prototype, 'draw', {});

    expect(observations).toEqual([]);
  });

  it("records the token's own drag callbacks", () => {
    const { observations, token } = install();

    call(token.prototype, '_onDragLeftStart', {}, { type: 'pointermove', button: 0 });
    call(token.prototype, '_onDragLeftDrop', {}, { type: 'pointerup', button: 0 });

    expect(observations).toEqual([
      '_onDragLeftStart [pointermove button=0 n/a]',
      '_onDragLeftDrop [pointerup button=0 n/a]',
    ]);
  });

  /**
   * The property that makes this safe to leave installed in a live game: every wrap is transparent.
   */
  it('calls the original with the original this, and returns its result untouched', () => {
    const { token, manager } = install();
    const self = { marker: 'the real token' };

    expect(call(token.prototype, 'draw', self, 'arg')).toBe('draw-result');
    expect(call(manager.prototype, 'cancel', { state: 1 }, 'arg')).toBe('cancel-result');

    expect(token.calls[0]?.self).toBe(self);
    expect(token.calls[0]?.args).toEqual(['arg']);
    expect(manager.calls[0]?.args).toEqual(['arg']);
  });

  it('reports that nothing was installed when Foundry is not ready', () => {
    const { installed, observations } = install({ getTokenPrototype: () => undefined });

    expect(installed).toEqual({ token: false, manager: false });
    expect(observations).toEqual([]);
  });

  /** The manager is reached through a live token, so it can be absent while the token class is not. */
  it('still hooks the token when the manager cannot be reached yet', () => {
    const { installed, observations, token } = install({ getManagerPrototype: () => undefined });

    // The manager is reached through a live token, so "token yes, manager no" is a normal state and
    // must be reported as such rather than collapsed into a single boolean.
    expect(installed).toEqual({ token: true, manager: false });
    call(token.prototype, 'draw', {});
    expect(observations).toHaveLength(1);
  });

  it('skips a method the prototype does not have', () => {
    const observations: string[] = [];

    const installed = installFoundryDragHooks({
      getTokenPrototype: () => ({}),
      getManagerPrototype: () => ({}),
      isRecording: () => true,
      onObservation: (note) => observations.push(note),
    });

    expect(installed).toEqual({ token: true, manager: true });
    expect(observations).toEqual([]);
  });
});

describe('summariseDragEndings', () => {
  it('says nothing was observed, and that the observers were installed', () => {
    expect(summariseDragEndings([])).toContain('observers ARE installed');
  });

  /**
   * ⚠️ Silence and not watching must never read the same. A device reported "NOTHING observed" while
   * the drag origin was demonstrably being wiped, which cannot both be true of a watched drag.
   */
  it('says NOT WATCHING when the observers never installed', () => {
    expect(summariseDragEndings([], { token: false, manager: false })).toContain('NOT WATCHING');
  });

  it('warns that a cancel would be invisible without the manager hook', () => {
    expect(summariseDragEndings([], { token: true, manager: false })).toContain(
      'MANAGER hook never installed'
    );
  });

  /** A redraw explains everything else, so it wins over the other verdicts. */
  it('blames a redraw above all else', () => {
    const summary = summariseDragEndings([
      'token.draw DURING THE DRAG (this cancels the interaction)',
      'manager.cancel at GRABBED [no event, Foundry did it itself]',
    ]);

    expect(summary).toContain('a REDRAW cancelled the interaction');
  });

  it('says a drop means the write itself refused', () => {
    expect(summariseDragEndings(['_onDragLeftDrop [pointerup button=0 mouse]'])).toContain(
      'the write itself refused'
    );
  });

  it('says a cancel writes nothing', () => {
    expect(summariseDragEndings(['manager.cancel at DRAG [contextmenu button=2 n/a]'])).toContain(
      'CANCELLED, which writes nothing'
    );
  });

  it('just lists observations it has no verdict for', () => {
    expect(summariseDragEndings(['_onDragLeftStart [pointermove button=0 n/a]'])).toBe(
      '_onDragLeftStart [pointermove button=0 n/a]'
    );
  });
});
