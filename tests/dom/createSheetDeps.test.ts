import { afterEach, describe, expect, it, vi } from 'vitest';

import { createSheetWithFoundry } from '../../src/foundry/CreateSheetDeps.js';

/**
 * The real Foundry calls behind creating a sheet. Written 2026-09-02.
 *
 * ⚠️ Every absence here THROWS rather than resolving quietly, and that is the whole point of the
 * file. `createSheetInParty` turns a thrown error into a reported outcome carrying its reason, so a
 * throw becomes a sentence the user reads. Returning null instead would produce the one thing this
 * feature must never do: a tap that changes nothing and says nothing.
 *
 * COVERS: each missing global, a party that does not support members, and the happy path.
 * MISSES: whether Foundry accepts the document. Only the live harness can say, and on pf2e rather
 *   than the sf2e this was designed against.
 */
const globals = globalThis as unknown as Record<string, unknown>;
const request = { name: 'Ana', ownerId: 'p1', partyUuid: 'Actor.party' };

afterEach(() => {
  Reflect.deleteProperty(globals, 'Actor');
  Reflect.deleteProperty(globals, 'fromUuid');
});

describe('creating through Foundry', () => {
  it('creates the actor and adds it to the party', async () => {
    const created = { uuid: 'Actor.new' };
    const addMembers = vi.fn(async () => Promise.resolve());
    globals['Actor'] = { create: vi.fn(async () => Promise.resolve(created)) };
    globals['fromUuid'] = vi.fn(async () => Promise.resolve({ addMembers }));

    const outcome = await createSheetWithFoundry(request);

    expect(outcome).toEqual({ kind: 'created', sheet: created });
    expect(addMembers).toHaveBeenCalledWith(created);
  });

  /**
   * ⛔ THE BUG THAT MADE CREATION NEVER WORK IN A REAL FOUNDRY. Found 2026-09-12 by the first live
   * press of the create button on PF2e, which logged "Cannot read properties of undefined (reading
   * 'implementation')" and made nothing.
   *
   * Foundry's `Document.create` is a STATIC METHOD THAT USES `this`:
   *
   *     static async create(data={}, operation={}) {
   *       const created = await this.implementation.createDocuments(createData, operation);
   *
   * The module pulled `create` off `Actor` and called it bare, so `this` was undefined. Every other
   * stub in this file is an arrow function or a `vi.fn`, neither of which reads `this`, so a detached
   * call works on them perfectly and the bug could not be seen from here. This stub is shaped like
   * the real method, which is the only way a desk test can catch it.
   *
   * ⚠️ Same shape as #347, where `ui.notifications.info` was handed out detached and recursed until
   * the stack ran out. That fix was made in one file; this was the same mistake in another.
   */
  it('calls Actor.create ON Actor, because Foundry reads this.implementation', async () => {
    const created = { uuid: 'Actor.new' };
    globals['Actor'] = {
      implementation: { createDocuments: async () => Promise.resolve([created]) },
      async create(this: { implementation: { createDocuments: () => Promise<unknown[]> } }) {
        return (await this.implementation.createDocuments()).shift();
      },
    };
    globals['fromUuid'] = vi.fn(async () =>
      Promise.resolve({ addMembers: async () => Promise.resolve() })
    );

    const outcome = await createSheetWithFoundry(request);

    expect(outcome).toEqual({ kind: 'created', sheet: created });
  });

  it('looks the party up by the uuid it was given', async () => {
    const fromUuid = vi.fn(async () =>
      Promise.resolve({ addMembers: async () => Promise.resolve() })
    );
    globals['Actor'] = { create: async () => Promise.resolve({ uuid: 'Actor.new' }) };
    globals['fromUuid'] = fromUuid;

    await createSheetWithFoundry(request);

    expect(fromUuid).toHaveBeenCalledWith('Actor.party');
  });

  /** ⚠️ Says WHICH global is missing. "Something went wrong" sends somebody nowhere. */
  it('says so when this client has no Actor.create', async () => {
    globals['fromUuid'] = async () => Promise.resolve(null);

    const outcome = await createSheetWithFoundry(request);

    expect(outcome.kind).toBe('notCreated');
    expect(outcome.kind === 'notCreated' ? outcome.reason : '').toContain('Actor.create');
  });

  it('says so when this client has no fromUuid', async () => {
    globals['Actor'] = { create: async () => Promise.resolve({ uuid: 'Actor.new' }) };

    const outcome = await createSheetWithFoundry(request);

    expect(outcome.kind).toBe('createdOutsideParty');
    expect(outcome.kind === 'createdOutsideParty' ? outcome.reason : '').toContain('fromUuid');
  });

  /**
   * ⚠️ THE LIKELIEST FAILURE IN THE WILD. This module knows parties from PF2e and its derivatives. A
   * world on some other system can have an actor at that uuid with no `addMembers` at all, and saying
   * so is how somebody finds out their system is not supported rather than concluding the button is
   * broken.
   */
  it('says the system cannot take party members, when the party has no addMembers', async () => {
    globals['Actor'] = { create: async () => Promise.resolve({ uuid: 'Actor.new' }) };
    globals['fromUuid'] = async () => Promise.resolve({});

    const outcome = await createSheetWithFoundry(request);

    expect(outcome.kind).toBe('createdOutsideParty');
    expect(outcome.kind === 'createdOutsideParty' ? outcome.reason : '').toContain(
      'cannot take members'
    );
  });

  /** ⚠️ A uuid that resolves to nothing is the same story: the sheet exists, the party did not. */
  it('reports a party uuid that resolves to nothing', async () => {
    globals['Actor'] = { create: async () => Promise.resolve({ uuid: 'Actor.new' }) };
    globals['fromUuid'] = async () => Promise.resolve(null);

    const outcome = await createSheetWithFoundry(request);

    expect(outcome.kind).toBe('createdOutsideParty');
  });

  it('passes the document data through, ownership and all', async () => {
    const create = vi.fn(async () => Promise.resolve({ uuid: 'Actor.new' }));
    globals['Actor'] = { create };
    globals['fromUuid'] = async () =>
      Promise.resolve({ addMembers: async () => Promise.resolve() });

    await createSheetWithFoundry(request);

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Ana', type: 'character', ownership: { p1: 3 } })
    );
  });
});
