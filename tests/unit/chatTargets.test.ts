import { describe, expect, it, vi } from 'vitest';

import { readChatTargets } from '../../src/debug/ChatTargets.js';

/**
 * Where a diagnostics report can be sent.
 *
 * Three separate globals, each absent for a DIFFERENT reason: `ChatMessage` before the world loads,
 * `ui.notifications` on a client that never rendered the interface, and the user id for a session
 * that has not joined. None of them is an error, and the report still has somewhere to go.
 */
describe('readChatTargets', () => {
  it('finds both when Foundry is fully up', () => {
    const create = vi.fn();
    const info = vi.fn();

    const targets = readChatTargets({ ChatMessage: { create }, ui: { notifications: { info } } });

    /*
     * ⛔ WAS `expect(targets.createChatMessage).toBe(create)`, directly above the comment below that
     * explains why an identity check protects a bug. It did exactly that: `ChatMessage.create` must
     * be BOUND for the same reason `notify` must, and `.bind` returns a new function, so this
     * assertion failed the moment the second port was fixed. Changed 2026-09-12 to assert the call
     * arrives, like its neighbour.
     */
    targets.createChatMessage?.({ content: 'hi' });
    expect(create).toHaveBeenCalledWith({ content: 'hi' });
    /*
     * ⚠️ Asserts that calling it REACHES the notifier, not that it IS the same function object.
     * `toBe(info)` was the original assertion and it actively forbade the fix: `notify` must be
     * BOUND, because Foundry's `info` delegates through `this.notify` and a detached copy re-entered
     * itself until the stack ran out. An identity check pins the mechanism and protected the bug.
     */
    targets.notify?.('hello');
    expect(info).toHaveBeenCalledWith('hello');
  });

  /**
   * ⚠️ Read as separate optional chains rather than one guard over both, because they fail
   * INDEPENDENTLY: a world can have chat while the notification banner is unavailable, and a client
   * can have notifications up before chat exists. Treating them as one thing loses the report
   * entirely whenever either is missing, and the whole point is that it reaches somebody holding a
   * phone with no devtools.
   */
  it('still finds chat when notifications are unavailable', () => {
    const create = vi.fn();

    const targets = readChatTargets({ ChatMessage: { create } });

    /* ⚠️ Behaviour, not identity, for the reason given in the test above. */
    targets.createChatMessage?.({ content: 'hi' });
    expect(create).toHaveBeenCalledWith({ content: 'hi' });
    expect(targets.notify).toBeUndefined();
  });

  it('still finds notifications when chat is unavailable', () => {
    const info = vi.fn();

    const targets = readChatTargets({ ui: { notifications: { info } } });

    expect(targets.createChatMessage).toBeUndefined();
    /*
     * ⚠️ Asserts that calling it REACHES the notifier, not that it IS the same function object.
     * `toBe(info)` was the original assertion and it actively forbade the fix: `notify` must be
     * BOUND, because Foundry's `info` delegates through `this.notify` and a detached copy re-entered
     * itself until the stack ran out. An identity check pins the mechanism and protected the bug.
     */
    targets.notify?.('hello');
    expect(info).toHaveBeenCalledWith('hello');
  });

  it('reports both as absent rather than throwing when neither exists', () => {
    expect(readChatTargets({})).toEqual({ createChatMessage: undefined, notify: undefined });
  });

  it('copes with each global existing but hollow', () => {
    expect(readChatTargets({ ChatMessage: {}, ui: {} })).toEqual({
      createChatMessage: undefined,
      notify: undefined,
    });
    expect(readChatTargets({ ui: { notifications: {} } }).notify).toBeUndefined();
  });
});
