import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildCreationRelay } from '../../src/relay/BuildCreationRelay.js';
import {
  clearFoundry,
  globals,
  stubFoundryDocuments,
  world,
} from './support/creationRelayGlobals.js';

/**
 * The real Foundry behind the creation relay. Written 2026-09-03.
 *
 * ⚠️ Driven through the RELAY rather than by reading the options object back. Asserting the shape of
 * a config object proves it was written; asking the relay to do something proves it was wired.
 *
 * COVERS: the socket, presence, the world read, and the create call.
 * MISSES: whether Foundry's `Actor.create` really returns a document with a uuid. That belongs to the
 *   live harness. What a request carries lives in `buildCreationRelayRequests.test.ts`.
 */
beforeEach(stubFoundryDocuments);

afterEach(clearFoundry);

describe('binding to Foundry’s socket', () => {
  it('binds when there is a socket', () => {
    world();
    const relay = buildCreationRelay();
    relay.bind();

    expect(relay.isBound()).toBe(true);
    relay.unbind();
  });

  it('does not bind when there is no socket yet', () => {
    world({ socket: undefined });
    const relay = buildCreationRelay();
    relay.bind();

    expect(relay.isBound()).toBe(false);
  });

  /**
   * ⚠️ Read LAZILY, and this is the test that says so. The module is constructed before Foundry
   * finishes setting itself up, so a relay that captured `game.socket` at build time would be
   * permanently unbound on exactly the clients that start fastest.
   */
  it('finds a socket that only appeared after it was built', () => {
    world({ socket: undefined });
    const relay = buildCreationRelay();

    world();
    relay.bind();

    expect(relay.isBound()).toBe(true);
    relay.unbind();
  });
});

describe('a designated GM creating for themselves', () => {
  it('creates through Foundry and hands back the uuid', async () => {
    world();

    expect(await buildCreationRelay().request('Actor.p', 'Bramble')).toEqual({
      kind: 'created',
      actorUuid: 'Actor.new',
    });
  });

  /** ⚠️ The party's OPEN flag is read from the world, so a closed one is refused even here. */
  it('refuses a party that is not open', async () => {
    world();
    const game = globals['game'] as { actors: { getFlag: () => unknown }[] };
    const party = game.actors[0];
    if (party !== undefined) {
      party.getFlag = (): unknown => undefined;
    }

    const outcome = await buildCreationRelay().request('Actor.p', 'Bramble');

    expect(outcome.kind).toBe('refused');
  });

  /**
   * ⚠️ A missing `Actor.create` is REPORTED, not swallowed. `CreateSheetDeps` throws so the reason
   * reaches the user; a tap that changes nothing and says nothing is the one outcome this feature
   * must never produce.
   */
  it('reports why when Foundry cannot create', async () => {
    world();
    globals['Actor'] = {};

    const outcome = await buildCreationRelay().request('Actor.p', 'Bramble');

    expect(outcome.kind).toBe('refused');
    expect(outcome).toHaveProperty('reason', expect.stringContaining('Actor.create'));
  });

  /** ⚠️ A sheet made but left out of its party is still MADE, so it comes back as created. */
  it('still counts a sheet that could not join the party as created', async () => {
    world();
    globals['fromUuid'] = async () => Promise.resolve(null);

    expect(await buildCreationRelay().request('Actor.p', 'Bramble')).toEqual({
      kind: 'created',
      actorUuid: 'Actor.new',
    });
  });

  /**
   * ⚠️ CREATED, with nothing to open. Foundry can resolve `Actor.create` to something this module
   * reads no uuid from, and the sheet still exists. Reporting a failure would invite a second tap and
   * leave a duplicate character that a player cannot delete themselves.
   */
  it('reports a sheet made without a uuid as created, with nothing to open', async () => {
    world();
    globals['Actor'] = { create: async () => Promise.resolve({ name: 'Bramble' }) };

    expect(await buildCreationRelay().request('Actor.p', 'Bramble')).toEqual({
      kind: 'created',
      actorUuid: null,
    });
  });
});
