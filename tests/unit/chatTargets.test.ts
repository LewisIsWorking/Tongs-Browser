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

    expect(targets.createChatMessage).toBe(create);
    expect(targets.notify).toBe(info);
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

    expect(targets.createChatMessage).toBe(create);
    expect(targets.notify).toBeUndefined();
  });

  it('still finds notifications when chat is unavailable', () => {
    const info = vi.fn();

    const targets = readChatTargets({ ui: { notifications: { info } } });

    expect(targets.createChatMessage).toBeUndefined();
    expect(targets.notify).toBe(info);
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
