import { describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

import { CreationRelay } from '../../src/relay/CreationRelay.js';
import type { CreationRelayOptions } from '../../src/relay/CreationRelay.js';
import {
  AS_DESIGNATED_GM,
  AS_PLAYER,
  TestSocket,
  relayOptions,
} from './support/creationRelayWorld.js';

/**
 * A player asking a GM for a character sheet, over a socket everybody shares. Written 2026-09-03.
 *
 * ⚠️ The fake socket broadcasts to EVERY bound client, including the emitter, because Foundry does.
 * Every bug worth catching here is a consequence of that, and a more convenient fake would make all
 * of them untestable.
 *
 * COVERS: the round trip both ways, and who serves.
 * MISSES: whether Foundry's socket really broadcasts this way. That is the live harness's job; the
 *   fake encodes the claim rather than proving it. The outcomes with no round trip live in
 *   `creationRelayOutcomes.test.ts`, and who is allowed to settle in `creationRelayCrossTalk.test.ts`.
 */
/**
 * ⚠️ TYPED as the port it stands in for, not as a bare `vi.fn()`. An untyped mock widens to
 * `Procedure`, which compiles here and then fails to assign, and more importantly stops the compiler
 * checking that the assertions below name the right argument positions.
 */
type CreateFn = CreationRelayOptions['create'];

const madeIt = (): Mock<CreateFn> =>
  vi.fn<CreateFn>(async () => Promise.resolve({ ok: true, actorUuid: 'Actor.New' }));

describe('when the asker is the designated GM', () => {
  /** ⚠️ Acts DIRECTLY. A solo GM must not depend on a round trip that has nowhere to go. */
  it('creates without touching the socket', async () => {
    const socket = new TestSocket();
    const relay = new CreationRelay(
      relayOptions({
        socket,
        readPresence: () => AS_DESIGNATED_GM,
        myUserId: () => 'user-gm',
        create: madeIt(),
      })
    );

    const outcome = await relay.request('Actor.Open', 'Bramble');

    expect(outcome).toEqual({ kind: 'created', actorUuid: 'Actor.New' });
    expect(socket.sent).toHaveLength(0);
  });

  /** ⚠️ Works with NO socket at all, which is the case a round trip cannot cover. */
  it('creates with no socket', async () => {
    const relay = new CreationRelay(
      relayOptions({
        socket: null,
        readPresence: () => AS_DESIGNATED_GM,
        myUserId: () => 'user-gm',
      })
    );

    expect(await relay.request('Actor.Open', 'Bramble')).toEqual({
      kind: 'created',
      actorUuid: 'Actor.New',
    });
  });
});

describe('when a player asks and a GM is listening', () => {
  const table = (): { player: CreationRelay; create: Mock<CreateFn> } => {
    const socket = new TestSocket();
    const create = madeIt();

    const gm = new CreationRelay(
      relayOptions({
        socket,
        readPresence: () => AS_DESIGNATED_GM,
        myUserId: () => 'user-gm',
        create,
      })
    );
    gm.bind();

    const player = new CreationRelay(
      relayOptions({ socket, readPresence: () => AS_PLAYER, myUserId: () => 'user-player' })
    );
    player.bind();

    return { player, create };
  };

  it('gets a sheet back', async () => {
    const { player, create } = table();

    expect(await player.request('Actor.Open', 'Bramble')).toEqual({
      kind: 'created',
      actorUuid: 'Actor.New',
    });
    expect(create).toHaveBeenCalledWith('user-player', 'Actor.Open', 'Bramble');
  });

  /**
   * ⚠️ Owned by the REQUESTER, not by the GM who ran it. This is the exact operation Foundry silently
   * mangles on a player's own client, deleting the ownership entry and leaving the sheet owned by the
   * creator. Getting it wrong here is the whole feature failing in the way nothing reports.
   */
  it('creates it owned by the player who asked, not by the GM who ran it', async () => {
    const { player, create } = table();
    await player.request('Actor.Open', 'Bramble');

    expect(create.mock.calls[0]?.[0]).toBe('user-player');
  });

  it('passes a refusal back in the words the GM gave', async () => {
    const socket = new TestSocket();
    new CreationRelay(
      relayOptions({ socket, readPresence: () => AS_DESIGNATED_GM, myUserId: () => 'user-gm' })
    ).bind();
    const player = new CreationRelay(
      relayOptions({ socket, readPresence: () => AS_PLAYER, myUserId: () => 'user-player' })
    );
    player.bind();

    const outcome = await player.request('Actor.Closed', 'Bramble');

    expect(outcome.kind).toBe('refused');
    expect(outcome).toHaveProperty('reason', expect.stringContaining('not one I can see'));
  });
});

describe('who serves a request', () => {
  /** ⚠️ THREE GMs, ONE sheet. Without the designated check every GM serves and the table gets three. */
  it('is served once even with three GMs bound', async () => {
    const socket = new TestSocket();
    const create = madeIt();
    new CreationRelay(
      relayOptions({
        socket,
        readPresence: () => AS_DESIGNATED_GM,
        myUserId: () => 'user-gm',
        create,
      })
    ).bind();

    for (const id of ['user-gm-2', 'user-gm-3']) {
      new CreationRelay(
        relayOptions({ socket, readPresence: () => AS_PLAYER, myUserId: () => id, create })
      ).bind();
    }

    const player = new CreationRelay(
      relayOptions({ socket, readPresence: () => AS_PLAYER, myUserId: () => 'user-player' })
    );
    player.bind();
    await player.request('Actor.Open', 'Bramble');

    expect(create).toHaveBeenCalledTimes(1);
  });
});
