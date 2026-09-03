import { describe, expect, it, vi } from 'vitest';

import { CreationRelay } from '../../src/relay/CreationRelay.js';
import {
  AS_DESIGNATED_GM,
  AS_PLAYER,
  CHANNEL,
  NO_GM,
  TestSocket,
  manualTimers,
  relayOptions,
} from './support/creationRelayWorld.js';

/**
 * Every way an ask can end without a sheet. Written 2026-09-03, split from `creationRelay.test.ts`
 * when it crossed the size limit.
 *
 * ⚠️ These outcomes exist because a sheet created elsewhere is INVISIBLE to the person who asked for
 * it. Nothing moves on their screen, so "it worked", "nobody was listening" and "you were refused"
 * are indistinguishable unless each comes back as itself. A single `false` would be useless.
 *
 * COVERS: no GM, no socket, the order those two are checked in, a timeout, and binding.
 * MISSES: the round trip itself, which lives in `creationRelay.test.ts`.
 */
describe('when nothing can be done', () => {
  it('says no GM is online rather than waiting for one', async () => {
    const relay = new CreationRelay(relayOptions({ readPresence: () => NO_GM }));

    expect(await relay.request('Actor.Open', 'Bramble')).toEqual({ kind: 'noGm' });
  });

  /**
   * ⚠️ ORDER, asserted deliberately. Both conditions hold here, and "nobody can do this for you" is
   * the truer and more actionable of the two. Telling a player there is no socket sends them to look
   * at their connection when the answer is that their GM is not logged in.
   */
  it('prefers the no-GM answer over the no-socket one when both are true', async () => {
    const relay = new CreationRelay(relayOptions({ socket: null, readPresence: () => NO_GM }));

    expect(await relay.request('Actor.Open', 'Bramble')).toEqual({ kind: 'noGm' });
  });

  it('says there is no socket when a GM is online but unreachable', async () => {
    const relay = new CreationRelay(relayOptions({ socket: null, readPresence: () => AS_PLAYER }));

    expect(await relay.request('Actor.Open', 'Bramble')).toEqual({ kind: 'noSocket' });
  });

  /**
   * ⚠️ A GM that drops mid-flight answers nobody. Without the timer the requester waits behind
   * something that resolves never, which reads as the module hanging rather than as a lost request.
   */
  it('gives up when nobody answers', async () => {
    const timers = manualTimers();
    const relay = new CreationRelay(
      relayOptions({ readPresence: () => AS_PLAYER, timers: timers.ports })
    );
    relay.bind();

    const pending = relay.request('Actor.Open', 'Bramble');
    timers.fire();

    expect(await pending).toEqual({ kind: 'timedOut' });
  });
});

describe('binding', () => {
  it('does not bind without a socket', () => {
    const relay = new CreationRelay(relayOptions({ socket: null }));
    relay.bind();

    expect(relay.isBound()).toBe(false);
  });

  /** ⚠️ Unbinding something never bound must be harmless. Teardown runs on paths setup did not. */
  it('unbinds harmlessly when it was never bound', () => {
    const relay = new CreationRelay(relayOptions());

    expect(() => {
      relay.unbind();
    }).not.toThrow();
    expect(relay.isBound()).toBe(false);
  });

  it('binds once and unbinds', () => {
    const relay = new CreationRelay(relayOptions());
    relay.bind();
    relay.bind();
    expect(relay.isBound()).toBe(true);

    relay.unbind();
    expect(relay.isBound()).toBe(false);
  });

  /** ⚠️ Unbinding must actually stop it SERVING, not merely flip a flag nothing consults. */
  it('stops serving once unbound', async () => {
    const socket = new TestSocket();
    const create = vi.fn(async () => Promise.resolve({ ok: true }));
    const gm = new CreationRelay(
      relayOptions({
        socket,
        readPresence: () => AS_DESIGNATED_GM,
        myUserId: () => 'user-gm',
        create,
      })
    );
    gm.bind();
    gm.unbind();

    const timers = manualTimers();
    const player = new CreationRelay(
      relayOptions({ socket, readPresence: () => AS_PLAYER, timers: timers.ports })
    );
    player.bind();
    const pending = player.request('Actor.Open', 'Bramble');
    timers.fire();

    expect(await pending).toEqual({ kind: 'timedOut' });
    expect(create).not.toHaveBeenCalled();
  });

  /** ⚠️ Another module's traffic shares this channel shape. Ignoring it must not throw. */
  it('ignores a payload that is not ours', () => {
    const socket = new TestSocket();
    const relay = new CreationRelay(relayOptions({ socket }));
    relay.bind();

    expect(() => {
      socket.emit(CHANNEL, { action: 'togglePause', pause: true });
    }).not.toThrow();
  });
});

describe('when the create itself fails', () => {
  /** ⚠️ A GM whose `Actor.create` throws or returns false must still SAY so, not fall silent. */
  it('reports the reason the create gave', async () => {
    const relay = new CreationRelay(
      relayOptions({
        readPresence: () => AS_DESIGNATED_GM,
        myUserId: () => 'user-gm',
        create: async () => Promise.resolve({ ok: false, reason: 'The world is locked.' }),
      })
    );

    expect(await relay.request('Actor.Open', 'Bramble')).toEqual({
      kind: 'refused',
      reason: 'The world is locked.',
    });
  });

  /**
   * ⚠️ A create can succeed WITHOUT handing back a uuid, and that is not a failure. Foundry's
   * `Actor.create` can resolve to a document the caller does not read an id off. The sheet exists, so
   * the honest answer is "created, and I cannot open it for you", never "it failed".
   */
  it('reports a create that succeeded without giving back a uuid', async () => {
    const relay = new CreationRelay(
      relayOptions({
        readPresence: () => AS_DESIGNATED_GM,
        myUserId: () => 'user-gm',
        create: async () => Promise.resolve({ ok: true }),
      })
    );

    expect(await relay.request('Actor.Open', 'Bramble')).toEqual({
      kind: 'created',
      actorUuid: null,
    });
  });

  it('still says something when the create gives no reason', async () => {
    const relay = new CreationRelay(
      relayOptions({
        readPresence: () => AS_DESIGNATED_GM,
        myUserId: () => 'user-gm',
        create: async () => Promise.resolve({ ok: false }),
      })
    );

    const outcome = await relay.request('Actor.Open', 'Bramble');

    expect(outcome.kind).toBe('refused');
    expect(outcome).toHaveProperty('reason', expect.stringContaining('could not be created'));
  });
});
