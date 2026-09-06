import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CreationRelay } from '../../src/relay/CreationRelay.js';
import { proves, UNPROVEN_REASON } from '../../src/relay/RequestProof.js';
import {
  AS_DESIGNATED_GM,
  AS_PLAYER,
  TestSocket,
  relayOptions,
  resetProofs,
  testProof,
} from './support/creationRelayWorld.js';

/**
 * Proving a create request came from the user it names. Written 2026-09-06.
 *
 * ⛔ THE ATTACK THIS EXISTS TO STOP, and it is the test that matters: core Foundry rebroadcasts a
 * socket payload without a verified sender, so before this, a player could emit a request naming
 * SOMEBODY ELSE'S user id and have the sheet created owned by them.
 *
 * COVERS: the decision (`proves`) and the relay's use of it, both directions, plus the replay.
 * MISSES: whether Foundry's server really refuses a player writing a flag to another user. That is
 *   read from Foundry 14.366's own source in `RequestProof`'s docblock, not probed here, and a unit
 *   test could not establish it in any case: the fake obeys the rule because it was written to.
 */

beforeEach(resetProofs);

describe('proves', () => {
  it('accepts a claim that matches the request', () => {
    expect(proves('req-1', 'req-1')).toBe(true);
  });

  /** ⚠️ The point of the whole module: a user with no claim vouches for nothing. */
  it('rejects when the named user is claiming nothing', () => {
    expect(proves(null, 'req-1')).toBe(false);
  });

  /**
   * ⛔ NOT a presence check. A "has any claim at all" test would be satisfied by a victim's own
   * unrelated pending request, letting an attacker ride along on somebody else's genuine ask.
   */
  it('rejects a claim for a DIFFERENT request', () => {
    expect(proves('req-other', 'req-1')).toBe(false);
  });

  /** ⚠️ Empty strings on either side are not a match. Two blanks must not prove each other. */
  it('rejects empty on either side', () => {
    expect(proves('', '')).toBe(false);
    expect(proves('req-1', '')).toBe(false);
    expect(proves('', 'req-1')).toBe(false);
  });
});

describe('the GM serving a request', () => {
  /** The honest path: the requester claimed, so the GM believes them. */
  it('creates when the claim matches', async () => {
    const socket = new TestSocket();
    const create = vi.fn(async () => Promise.resolve({ ok: true, actorUuid: 'Actor.New' }));
    new CreationRelay(
      relayOptions({
        socket,
        readPresence: () => AS_DESIGNATED_GM,
        myUserId: () => 'user-gm',
        create,
      })
    ).bind();

    const player = new CreationRelay(relayOptions({ socket, readPresence: () => AS_PLAYER }));
    player.bind();

    expect(await player.request('Actor.Open', 'Bramble')).toEqual({
      kind: 'created',
      actorUuid: 'Actor.New',
    });
    expect(create).toHaveBeenCalledOnce();
  });

  /**
   * ⛔ THE ATTACK. Mallory claims on her own document, then emits a payload naming Ana. The GM reads
   * ANA's document, finds nothing, and refuses. Before the proof this created a sheet owned by Ana.
   */
  it('refuses a request naming a user who claimed nothing', async () => {
    const socket = new TestSocket();
    const create = vi.fn(async () => Promise.resolve({ ok: true }));
    new CreationRelay(
      relayOptions({
        socket,
        readPresence: () => AS_DESIGNATED_GM,
        myUserId: () => 'user-gm',
        create,
      })
    ).bind();

    /* Mallory's own honest claim, which vouches for Mallory and for nobody else. */
    await testProof(() => 'user-mallory').claim('req-forged');

    socket.emit('module.tongs-browser', {
      action: 'createSheet',
      requestId: 'req-forged',
      userId: 'user-player',
      partyUuid: 'Actor.Open',
      name: 'Not Mine',
    });
    await Promise.resolve();

    expect(create).not.toHaveBeenCalled();
    expect(socket.sent).toContainEqual(
      expect.objectContaining({ ok: false, reason: UNPROVEN_REASON })
    );
  });

  /**
   * ⚠️ A claim is PUBLIC, so a hostile client can read a real request id off the wire and re-emit
   * the payload verbatim. Serving releases the claim, so the replay proves nothing.
   */
  it('refuses a replay of a request it already served', async () => {
    const socket = new TestSocket();
    const create = vi.fn(async () => Promise.resolve({ ok: true }));
    new CreationRelay(
      relayOptions({
        socket,
        readPresence: () => AS_DESIGNATED_GM,
        myUserId: () => 'user-gm',
        create,
      })
    ).bind();

    const player = new CreationRelay(relayOptions({ socket, readPresence: () => AS_PLAYER }));
    player.bind();
    await player.request('Actor.Open', 'Bramble');
    expect(create).toHaveBeenCalledOnce();

    socket.emit('module.tongs-browser', {
      action: 'createSheet',
      requestId: 'req-1',
      userId: 'user-player',
      partyUuid: 'Actor.Open',
      name: 'Bramble',
    });
    await Promise.resolve();

    expect(create).toHaveBeenCalledOnce();
  });
});

describe('a GM asking for themselves', () => {
  /**
   * ⚠️ Needs NO claim, and that is correct rather than an exemption. The id comes from this client's
   * own `game.user` and never crosses a socket, so there is no claim to doubt. Requiring one would
   * make a solo GM depend on a write that exists only to answer a question nobody asked.
   */
  it('creates directly without any claim on file', async () => {
    const create = vi.fn(async () => Promise.resolve({ ok: true, actorUuid: 'Actor.New' }));
    const gm = new CreationRelay(
      relayOptions({ readPresence: () => AS_DESIGNATED_GM, myUserId: () => 'user-gm', create })
    );

    expect(await gm.request('Actor.Open', 'Bramble')).toEqual({
      kind: 'created',
      actorUuid: 'Actor.New',
    });
  });
});
