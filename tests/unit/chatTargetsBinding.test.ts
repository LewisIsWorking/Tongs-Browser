import { describe, expect, it } from 'vitest';

import { readChatTargets } from '../../src/debug/ChatTargets.js';

/**
 * `notify` must arrive BOUND to Foundry's notifications object. Written 2026-09-08.
 *
 * ⛔ THE BUG, found on the first world that ever had parties in it. Foundry implements
 * `info(message, options) { return this.notify(message, "info", options) }`. Handed out detached and
 * called as `readChatTargets(globalThis).notify?.(message)`, `this` became the object literal
 * `readChatTargets` returns, that literal has a `notify` property holding THE SAME FUNCTION, and so
 * `info` called itself until the stack ran out.
 *
 * ⛔ WHY IT SURVIVED EVERYTHING. Losing `this` normally throws at once. Here the accidental receiver
 * carried a property of exactly the right name, so the failure was infinite recursion whose stack is
 * entirely Foundry's own minified source, with not one frame of this module in it. Nothing in a
 * fixture that stubs `notify` as a plain function can see it either: the recursion needs Foundry's
 * real shape, where `info` delegates to `notify`.
 */

/** Foundry's actual shape: `info` delegates to `notify` through `this`. */
const foundryLike = () => {
  const seen: string[] = [];
  return {
    seen,
    notifications: {
      info(message: string) {
        (this as { notify: (m: string) => void }).notify(message);
      },
      notify(message: string) {
        seen.push(message);
      },
    },
  };
};

describe('the notify port', () => {
  /** ⛔ Unbound, this recursed until the stack ran out. Bound, it reaches the real notify once. */
  it('reaches Foundry’s notify rather than calling itself', () => {
    const foundry = foundryLike();

    const targets = readChatTargets({ ui: { notifications: foundry.notifications } });
    targets.notify?.('a message');

    expect(foundry.seen).toEqual(['a message']);
  });

  /**
   * ⚠️ Called the way the real caller calls it: straight off the returned object. That is what made
   * the returned literal the receiver, and the literal's own `notify` the thing `info` re-entered.
   */
  it('survives being called as a property of the object it was returned in', () => {
    const foundry = foundryLike();

    readChatTargets({ ui: { notifications: foundry.notifications } }).notify?.('off the literal');

    expect(foundry.seen).toEqual(['off the literal']);
  });

  /** ⚠️ Absence still reads as undefined, so callers can tell "no banner" from "banner that failed". */
  it('is undefined when there are no notifications at all', () => {
    expect(readChatTargets({}).notify).toBeUndefined();
    expect(readChatTargets({ ui: {} }).notify).toBeUndefined();
    expect(readChatTargets({ ui: { notifications: {} } }).notify).toBeUndefined();
  });
});
