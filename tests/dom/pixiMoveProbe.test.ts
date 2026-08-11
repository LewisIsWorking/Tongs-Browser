import { describe, expect, it } from 'vitest';

import { PixiMoveProbe } from '../../src/debug/PixiMoveProbe.js';

/**
 * The layer and stage move counters.
 *
 * The interesting property is not the counting, it is the attaching: these are listeners on objects
 * Foundry owns, so attaching twice would leak a set per gesture across a scene change, and attaching
 * eagerly would attach to nothing because the canvas does not exist when the module is built.
 */
function emitter() {
  const handlers: Record<string, (() => void)[]> = {};
  return {
    on: (event: string, handler: () => void) => {
      (handlers[event] ??= []).push(handler);
    },
    fire: (event: string) => {
      for (const handler of handlers[event] ?? []) {
        handler();
      }
    },
    count: (event: string) => (handlers[event] ?? []).length,
  };
}

describe('PixiMoveProbe', () => {
  it('counts moves on the token layer and the stage separately', () => {
    const tokens = emitter();
    const stage = emitter();
    const probe = new PixiMoveProbe(() => ({ tokens, stage }));

    probe.attach();
    tokens.fire('pointermove');
    tokens.fire('pointermove');
    stage.fire('pointermove');

    expect(probe.getCounts()).toMatchObject({ layer: 2, stage: 1, attached: true });
  });

  /** Attaching twice would double count and leak a listener set on every gesture. */
  it('attaches only once, however often it is asked', () => {
    const tokens = emitter();
    const stage = emitter();
    const probe = new PixiMoveProbe(() => ({ tokens, stage }));

    probe.attach();
    probe.attach();
    probe.attach();

    expect(tokens.count('pointermove')).toBe(1);
    expect(stage.count('pointermove')).toBe(1);
  });

  /**
   * The canvas is absent early and arrives later, which is why attaching is safe to call on every
   * dispatch. Failing to attach must leave the probe willing to try again, not mark itself done.
   */
  it('stays unattached until the canvas exists, then attaches', () => {
    let canvas: { tokens?: ReturnType<typeof emitter>; stage?: ReturnType<typeof emitter> } = {};
    const probe = new PixiMoveProbe(() => canvas);

    probe.attach();
    expect(probe.getCounts().attached).toBe(false);

    const tokens = emitter();
    const stage = emitter();
    canvas = { tokens, stage };

    probe.attach();
    expect(probe.getCounts().attached).toBe(true);

    tokens.fire('pointermove');
    expect(probe.getCounts().layer).toBe(1);
  });

  it('stays unattached when there is no canvas at all', () => {
    const probe = new PixiMoveProbe(() => undefined);

    probe.attach();

    expect(probe.getCounts()).toMatchObject({ layer: 0, stage: 0, attached: false });
  });

  /** A half built canvas, with a stage but no token layer, must not attach half a probe. */
  it('refuses to attach to a canvas missing either emitter', () => {
    const stage = emitter();
    const probe = new PixiMoveProbe(() => ({ stage }));

    probe.attach();

    expect(probe.getCounts().attached).toBe(false);
    expect(stage.count('pointermove')).toBe(0);
  });

  /**
   * Resetting clears the counts for a new gesture but must NOT detach, because the listeners are
   * still bound to Foundry's objects and re-attaching would add a second set.
   */
  it('clears counts on reset while staying attached', () => {
    const tokens = emitter();
    const stage = emitter();
    const probe = new PixiMoveProbe(() => ({ tokens, stage }));

    probe.attach();
    tokens.fire('pointermove');
    stage.fire('pointermove');
    probe.resetCounts();

    expect(probe.getCounts()).toMatchObject({ layer: 0, stage: 0, attached: true });

    probe.attach();
    tokens.fire('pointermove');

    // Still one listener, so one fire is one count. Two would mean reset had allowed a re-attach.
    expect(probe.getCounts().layer).toBe(1);
  });
});

/**
 * The token counter, which is the one that decides a drag.
 *
 * Foundry evaluates its 10px drag gate in a handler bound on the OBJECT, and PIXI delivers to an
 * object only while the pointer is over it. A layer count stays perfectly healthy while the token
 * receives nothing, which is exactly how a layer count came to be read three times as though it
 * answered this question.
 */
describe('PixiMoveProbe and the controlled token', () => {
  function tokenEmitter() {
    const handlers: (() => void)[] = [];
    return {
      on: (_event: string, handler: () => void) => handlers.push(handler),
      fire: () => {
        for (const handler of handlers) {
          handler();
        }
      },
      listeners: () => handlers.length,
    };
  }

  it('counts moves delivered to the controlled token', () => {
    const token = tokenEmitter();
    const probe = new PixiMoveProbe(() => ({ tokens: { controlled: [token] } }));

    probe.attachToControlledToken();
    token.fire();
    token.fire();

    expect(probe.getCounts().token).toBe(2);
    expect(probe.getCounts().tokenAttached).toBe(true);
  });

  it('does not stack listeners when asked repeatedly for the same token', () => {
    const token = tokenEmitter();
    const probe = new PixiMoveProbe(() => ({ tokens: { controlled: [token] } }));

    probe.attachToControlledToken();
    probe.attachToControlledToken();
    probe.attachToControlledToken();

    expect(token.listeners()).toBe(1);
  });

  /** Selecting a different token must move the counter to it, and start it from zero. */
  it('follows the selection to a new token and restarts the count', () => {
    const first = tokenEmitter();
    const second = tokenEmitter();
    let controlled = [first];
    const probe = new PixiMoveProbe(() => ({ tokens: { controlled } }));

    probe.attachToControlledToken();
    first.fire();
    expect(probe.getCounts().token).toBe(1);

    controlled = [second];
    probe.attachToControlledToken();
    expect(probe.getCounts().token).toBe(0);

    second.fire();
    expect(probe.getCounts().token).toBe(1);
    expect(first.listeners()).toBe(1);
  });

  it('stays unattached when nothing is controlled', () => {
    const probe = new PixiMoveProbe(() => ({ tokens: { controlled: [] } }));

    probe.attachToControlledToken();

    expect(probe.getCounts().tokenAttached).toBe(false);
    expect(probe.getCounts().token).toBe(0);
  });

  it('clears the token count on reset', () => {
    const token = tokenEmitter();
    const probe = new PixiMoveProbe(() => ({ tokens: { controlled: [token] } }));

    probe.attachToControlledToken();
    token.fire();
    probe.resetCounts();

    expect(probe.getCounts().token).toBe(0);
  });
});
