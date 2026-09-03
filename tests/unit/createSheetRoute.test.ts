import { describe, expect, it, vi } from 'vitest';

import { routeCreate } from '../../src/ui/CreateSheetRoute.js';
import type { CreateRouteDeps } from '../../src/ui/CreateSheetRoute.js';
import { RELAY_REASONS } from '../../src/ui/CreateSheetMessages.js';

/**
 * Which way a create goes, and how the answer is phrased. Written 2026-09-03.
 *
 * ⚠️ The distinction worth protecting is MADE versus FAILED. A sheet that exists but cannot be opened
 * is not a failure, and calling it one invites a second tap and a duplicate character: the exact
 * outcome a player cannot undo themselves. Three of the tests below are about that one word.
 *
 * COVERS: the routing rule, and every relay outcome becoming something the flow can report.
 * MISSES: whether a player's client really receives a document it was made the owner of. That is
 *   Foundry's behaviour and belongs to the live harness.
 */
const ASK = { name: 'Bramble', ownerId: 'user-player', partyUuid: 'Actor.Open' };

function deps(over: Partial<CreateRouteDeps> = {}): CreateRouteDeps {
  return {
    isGm: () => false,
    direct: vi.fn(async () =>
      Promise.resolve({ kind: 'created' as const, sheet: { uuid: 'direct' } })
    ),
    viaRelay: async () => Promise.resolve({ kind: 'created' as const, actorUuid: 'Actor.New' }),
    resolveSheet: async () => Promise.resolve({ uuid: 'Actor.New', name: 'Bramble' }),
    ...over,
  };
}

describe('which route it takes', () => {
  /** ⚠️ A GM goes direct even with a socket: they can already do it, so a round trip only adds a way
   * to fail, and a solo GM has nobody to ask. */
  it('sends a GM straight to Foundry', async () => {
    const direct = vi.fn(async () =>
      Promise.resolve({ kind: 'created' as const, sheet: { uuid: 'direct' } })
    );
    const viaRelay = vi.fn(async () =>
      Promise.resolve({ kind: 'created' as const, actorUuid: 'Actor.New' })
    );

    await routeCreate(deps({ isGm: () => true, direct, viaRelay }))(ASK);

    expect(direct).toHaveBeenCalledWith(ASK);
    expect(viaRelay).not.toHaveBeenCalled();
  });

  it('sends a player through the relay', async () => {
    const direct = vi.fn(async () =>
      Promise.resolve({ kind: 'created' as const, sheet: { uuid: 'direct' } })
    );
    const viaRelay = vi.fn(async () =>
      Promise.resolve({ kind: 'created' as const, actorUuid: 'Actor.New' })
    );

    await routeCreate(deps({ direct, viaRelay }))(ASK);

    expect(viaRelay).toHaveBeenCalledWith('Actor.Open', 'Bramble');
    expect(direct).not.toHaveBeenCalled();
  });
});

describe('when the relay says it worked', () => {
  it('hands back a sheet the flow can open', async () => {
    const outcome = await routeCreate(deps())(ASK);

    expect(outcome).toEqual({ kind: 'created', sheet: { uuid: 'Actor.New', name: 'Bramble' } });
  });

  /**
   * ⚠️ MADE, not failed, and this is the case that matters most. The sheet exists. Reporting a
   * failure would invite a second tap and leave the player with two characters and no way to remove
   * either, since deleting is not something they are allowed to do.
   */
  it('says the sheet was made when it has not arrived on this client yet', async () => {
    const outcome = await routeCreate(deps({ resolveSheet: async () => Promise.resolve(null) }))(
      ASK
    );

    expect(outcome).toHaveProperty('kind', 'createdOutsideParty');
    expect(outcome).toHaveProperty('reason', RELAY_REASONS.madeButUnreachable);
  });

  /** ⚠️ Also MADE. A GM that answered without a uuid still created something. */
  it('says the sheet was made when the GM did not name it', async () => {
    const outcome = await routeCreate(
      deps({ viaRelay: async () => Promise.resolve({ kind: 'created', actorUuid: null }) })
    )(ASK);

    expect(outcome).toHaveProperty('kind', 'createdOutsideParty');
    expect(outcome).toHaveProperty('reason', RELAY_REASONS.madeButUnknown);
  });

  /** ⚠️ The uuid is carried through even unopenable, so the report can name what was made. */
  it('keeps the uuid when the sheet has not arrived', async () => {
    const outcome = await routeCreate(deps({ resolveSheet: async () => Promise.resolve(null) }))(
      ASK
    );

    expect(outcome).toHaveProperty('sheet', { uuid: 'Actor.New' });
  });
});

describe('when it did not work', () => {
  it('passes a refusal through in the GM’s own words', async () => {
    const outcome = await routeCreate(
      deps({
        viaRelay: async () => Promise.resolve({ kind: 'refused', reason: 'That party is closed.' }),
      })
    )(ASK);

    expect(outcome).toEqual({ kind: 'notCreated', reason: 'That party is closed.' });
  });

  /**
   * ⚠️ THREE distinct reasons rather than one. Each names a different thing to do: wait for a GM,
   * check the connection, or try again. Collapsing them leaves a player with a dead button and no
   * idea which of the three they are looking at.
   */
  it.each([
    ['noGm', RELAY_REASONS.noGm],
    ['noSocket', RELAY_REASONS.noSocket],
    ['timedOut', RELAY_REASONS.timedOut],
  ])('explains %s in its own words', async (kind, reason) => {
    const outcome = await routeCreate(
      deps({ viaRelay: async () => Promise.resolve({ kind } as never) })
    )(ASK);

    expect(outcome).toEqual({ kind: 'notCreated', reason });
  });

  it('gives each of the three a different message', () => {
    const messages = new Set([RELAY_REASONS.noGm, RELAY_REASONS.noSocket, RELAY_REASONS.timedOut]);

    expect(messages.size).toBe(3);
  });
});
