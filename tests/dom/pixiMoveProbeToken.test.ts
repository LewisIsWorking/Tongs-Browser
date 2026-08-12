import { describe, expect, it } from 'vitest';

import { PixiMoveProbe } from '../../src/debug/PixiMoveProbe.js';

/**
 * The layer and stage move counters.
 *
 * The interesting property is not the counting, it is the attaching: these are listeners on objects
 * Foundry owns, so attaching twice would leak a set per gesture across a scene change, and attaching
 * eagerly would attach to nothing because the canvas does not exist when the module is built.
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
