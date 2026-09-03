import { describe, expect, it } from 'vitest';

import { CreationRelay } from '../../src/relay/CreationRelay.js';
import {
  AS_PLAYER,
  CHANNEL,
  TestSocket,
  manualTimers,
  relayOptions,
} from './support/creationRelayWorld.js';

/**
 * Two players at one table, listening to the same broadcast. Written 2026-09-03, split from
 * `creationRelay.test.ts` when it crossed the size limit.
 *
 * ⚠️ THE headline consequence of a channel everybody hears: when one player's answer goes out, every
 * other player receives it too, and must not take it as their own. Matching on `requestId` is the
 * only thing preventing that, and the failure looks like SUCCESS: the wrong player is handed a sheet
 * and told it worked.
 *
 * COVERS: an answer addressed to someone else being ignored, and the requester it IS addressed to
 *   still resolving.
 * MISSES: two answers arriving for the same id, which cannot happen while one GM is designated.
 */
describe('when two players are waiting at once', () => {
  it('does not let one player resolve on another player’s answer', async () => {
    /*
     * ⚠️ NO GM is bound here, deliberately. An earlier version of this test bound one, and the GM
     * legitimately answered BOTH requests, so there was no cross-talk left to observe: the test then
     * passed or failed on the authorisation policy rather than on the matching it was written for.
     * Emitting the answer by hand is what isolates the one behaviour under test.
     */
    const socket = new TestSocket();

    const bystanderTimers = manualTimers();
    const bystander = new CreationRelay(
      relayOptions({
        socket,
        readPresence: () => AS_PLAYER,
        myUserId: () => 'user-bystander',
        newRequestId: () => 'req-bystander',
        timers: bystanderTimers.ports,
      })
    );
    bystander.bind();
    const theirs = bystander.request('Actor.Open', 'Theirs');

    const asker = new CreationRelay(
      relayOptions({
        socket,
        readPresence: () => AS_PLAYER,
        myUserId: () => 'user-player',
        newRequestId: () => 'req-asker',
      })
    );
    asker.bind();
    const mine = asker.request('Actor.Open', 'Mine');

    socket.emit(CHANNEL, {
      action: 'createSheetResult',
      requestId: 'req-asker',
      ok: true,
      actorUuid: 'Actor.Mine',
    });

    expect(await mine).toEqual({ kind: 'created', actorUuid: 'Actor.Mine' });

    /* The bystander heard the same broadcast and correctly ignored it, so only a timeout ends it. */
    bystanderTimers.fire();
    expect(await theirs).toEqual({ kind: 'timedOut' });
  });
});

describe('an answer that is missing the parts it could have had', () => {
  const askAndAnswer = async (answer: Record<string, unknown>): Promise<unknown> => {
    const socket = new TestSocket();
    const relay = new CreationRelay(
      relayOptions({
        socket,
        readPresence: () => AS_PLAYER,
        myUserId: () => 'user-player',
        newRequestId: () => 'req-1',
      })
    );
    relay.bind();
    const waiting = relay.request('Actor.Open', 'Bramble');
    socket.emit(CHANNEL, { action: 'createSheetResult', requestId: 'req-1', ...answer });
    return waiting;
  };

  /** ⚠️ Success with no uuid is still success. The sheet exists; it just cannot be opened for you. */
  it('takes a success with no uuid as created', async () => {
    expect(await askAndAnswer({ ok: true })).toEqual({ kind: 'created', actorUuid: null });
  });

  /**
   * ⚠️ A refusal with no reason still has to SAY something. An empty message on a phone is
   * indistinguishable from the tap having missed, which is the failure this whole outcome type exists
   * to prevent.
   */
  it('says something when a refusal carries no reason', async () => {
    const outcome = await askAndAnswer({ ok: false });

    expect(outcome).toHaveProperty('kind', 'refused');
    expect(outcome).toHaveProperty('reason', expect.stringContaining('did not say why'));
  });
});
