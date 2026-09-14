import { afterEach, describe, expect, it, vi } from 'vitest';

import { watchMessages } from '../../src/deck/watchMessages.js';
import type { CreatedMessage, HooksLike } from '../../src/deck/watchMessages.js';

/**
 * Waiting for PF2e to report, per token, that something happened. Written 2026-09-13.
 *
 * ⚠️ The fake hooks read `this`, like every Foundry fake in the deck's tests, so a detached call fails
 * here rather than in a game.
 */
afterEach(() => {
  vi.useRealTimers();
});

const hooks = () => {
  const handlers = new Map<number, (message: CreatedMessage) => void>();
  let next = 1;
  const fake = {
    handlers,
    on(this: { handlers: typeof handlers }, _name: string, fn: (m: CreatedMessage) => void) {
      const id = next++;
      this.handlers.set(id, fn);
      return id;
    },
    off(this: { handlers: typeof handlers }, _name: string, id: number) {
      this.handlers.delete(id);
    },
    fire(message: CreatedMessage) {
      for (const fn of [...handlers.values()]) fn(message);
    },
  };
  return fake satisfies HooksLike;
};

const save = (token: string, system = 'pf2e', type = 'saving-throw'): CreatedMessage => ({
  flags: { [system]: { context: { type } } },
  speaker: { token },
});

const watch = (tokenIds: string[], timeoutMs = 1000) => ({
  systemId: 'pf2e',
  type: 'saving-throw',
  tokenIds,
  timeoutMs,
});

describe('every token must report', () => {
  /** ⛔ One goblin's save is not the whole group's. */
  it('waits for the last token before resolving true', async () => {
    const Hooks = hooks();
    let settled = false;
    const waiting = watchMessages(Hooks, watch(['A', 'B'])).then((value) => {
      settled = true;
      return value;
    });

    Hooks.fire(save('A'));
    await Promise.resolve();
    expect(settled).toBe(false);

    Hooks.fire(save('B'));
    await expect(waiting).resolves.toBe(true);
    expect(Hooks.handlers.size).toBe(0);
  });

  it('ignores another type, another system and another token', async () => {
    vi.useFakeTimers();
    const Hooks = hooks();
    const waiting = watchMessages(Hooks, watch(['A'], 500));

    Hooks.fire(save('A', 'pf2e', 'damage-taken'));
    Hooks.fire(save('A', 'sf2e'));
    Hooks.fire(save('Z'));
    Hooks.fire({
      flags: { pf2e: { context: { type: 'saving-throw' } } },
      speaker: { token: null },
    });
    vi.advanceTimersByTime(500);

    await expect(waiting).resolves.toBe(false);
  });
});

describe('when it cannot be confirmed', () => {
  it('resolves false and unhooks on timeout', async () => {
    vi.useFakeTimers();
    const Hooks = hooks();
    const waiting = watchMessages(Hooks, watch(['A'], 500));

    vi.advanceTimersByTime(500);

    await expect(waiting).resolves.toBe(false);
    expect(Hooks.handlers.size).toBe(0);
  });

  /** ⚠️ An empty list must not read as "everyone rolled". */
  it('is false at once, hooking nothing, for no tokens', async () => {
    const Hooks = hooks();

    await expect(watchMessages(Hooks, watch([]))).resolves.toBe(false);
    expect(Hooks.handlers.size).toBe(0);
  });

  it('is false at once without hooks', async () => {
    await expect(watchMessages(undefined, watch(['A']))).resolves.toBe(false);
  });
});

describe('when it is armed', () => {
  /** ⛔ Registered on the call itself, so a message posted in the same tick is still seen. */
  it('is listening before the call returns', async () => {
    const Hooks = hooks();

    const waiting = watchMessages(Hooks, watch(['A']));
    expect(Hooks.handlers.size).toBe(1);
    Hooks.fire(save('A'));

    await expect(waiting).resolves.toBe(true);
  });
});
