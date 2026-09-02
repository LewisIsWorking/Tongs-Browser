import { describe, expect, it, vi } from 'vitest';

import { createSheetInParty, sheetDocumentData } from '../../src/foundry/SheetCreation.js';
import { OWNER_LEVEL } from '../../src/foundry/SheetCreationTypes.js';
import type { CreatedSheet, SheetCreationDeps } from '../../src/foundry/SheetCreationTypes.js';

/**
 * Creating a sheet, owning it, and putting it in a party. Written 2026-09-02.
 *
 * ⚠️ The two assertions that matter most are both about NOT LYING to the user:
 *
 * - ownership is in the CREATE, because Foundry silently drops it from an update by a non-GM and the
 *   sheet would belong to nobody with no error anywhere
 * - a failed party join is reported as "created, but not in the party", not as failure, because the
 *   sheet exists and calling it a failure invites a duplicate
 *
 * COVERS: the document data, the order of the two writes, and each failure separately.
 * MISSES: whether Foundry accepts the data. That is the live harness's job, and on pf2e rather than
 *   the sf2e this was designed against.
 */
const sheet: CreatedSheet = { uuid: 'Actor.new', name: 'Ana' };

function deps(over: Partial<SheetCreationDeps> = {}): SheetCreationDeps {
  return {
    createActor: vi.fn(async () => Promise.resolve(sheet)),
    addToParty: vi.fn(async () => Promise.resolve()),
    ...over,
  };
}

const request = { name: 'Ana', ownerId: 'p1', partyUuid: 'Actor.party' };

describe('the document a new sheet is created from', () => {
  it('names the sheet and makes it a character', () => {
    const data = sheetDocumentData(request);

    expect(data['name']).toBe('Ana');
    expect(data['type']).toBe('character');
  });

  /**
   * ⚠️ OWNERSHIP IN THE CREATE. Foundry's `sanitizeDocumentOwnershipField` silently deletes an
   * ownership entry naming another user when it arrives on an UPDATE from a non-GM, so a
   * create-then-grant sequence would leave the sheet belonging to nobody with nothing reported.
   */
  it('gives the intended owner OWNER at creation, not afterwards', () => {
    expect(sheetDocumentData(request)['ownership']).toEqual({ p1: OWNER_LEVEL });
  });

  /**
   * ⚠️ Does NOT touch `default`. That would change what every other user in the world can see of this
   * sheet, which is the opposite of "never show what somebody has no permission to see".
   */
  it('does not widen visibility for everybody else', () => {
    expect(sheetDocumentData(request)['ownership']).not.toHaveProperty('default');
  });

  it('lets a system with a different player type say so', () => {
    expect(sheetDocumentData({ ...request, type: 'hero' })['type']).toBe('hero');
  });
});

describe('creating the sheet and putting it in the party', () => {
  it('creates first, then adds to the party', async () => {
    const order: string[] = [];
    const outcome = await createSheetInParty(request, {
      createActor: async () => {
        order.push('create');
        return Promise.resolve(sheet);
      },
      addToParty: async () => {
        order.push('addToParty');
        return Promise.resolve();
      },
    });

    expect(order).toEqual(['create', 'addToParty']);
    expect(outcome).toEqual({ kind: 'created', sheet });
  });

  it('adds the sheet it just created to the party it was told', async () => {
    const addToParty = vi.fn(async () => Promise.resolve());
    await createSheetInParty(request, deps({ addToParty }));

    expect(addToParty).toHaveBeenCalledWith('Actor.party', sheet);
  });

  it('reports the reason when the sheet could not be created', async () => {
    const outcome = await createSheetInParty(
      request,
      deps({
        createActor: async () => Promise.reject(new Error('no permission')),
      })
    );

    expect(outcome).toEqual({ kind: 'notCreated', reason: 'no permission' });
  });

  it('does not try to add anything to a party when creation failed', async () => {
    const addToParty = vi.fn(async () => Promise.resolve());
    await createSheetInParty(
      request,
      deps({ createActor: async () => Promise.reject(new Error('nope')), addToParty })
    );

    expect(addToParty).not.toHaveBeenCalled();
  });

  it('treats a null actor as a failure rather than carrying on with nothing', async () => {
    const outcome = await createSheetInParty(
      request,
      deps({ createActor: async () => Promise.resolve(null) })
    );

    expect(outcome.kind).toBe('notCreated');
  });

  /**
   * ⚠️ THE THIRD OUTCOME. The sheet EXISTS and is owned correctly; only the party join failed.
   * Reporting that as failure invites a second attempt and a duplicate, and the action the user needs
   * is "put it in the party", not "try again".
   */
  it('says the sheet was created but not added, when the party join fails', async () => {
    const outcome = await createSheetInParty(
      request,
      deps({ addToParty: async () => Promise.reject(new Error('party is locked')) })
    );

    expect(outcome).toEqual({
      kind: 'createdOutsideParty',
      sheet,
      reason: 'party is locked',
    });
  });

  /**
   * ⚠️ A thrown non-Error must not reach the user as `[object Object]`.
   *
   * The lint rule below is disabled ON PURPOSE and only here. It exists to stop production code
   * rejecting with a non-Error, which is exactly the badly behaved caller this test stands in for:
   * Foundry and its systems are somebody else's code, and "it will always throw an Error" is not a
   * promise this module gets to rely on.
   */
  it('describes a thrown non-error readably', async () => {
    const outcome = await createSheetInParty(
      request,
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
      deps({ createActor: async () => Promise.reject('just a string') })
    );

    expect(outcome).toEqual({ kind: 'notCreated', reason: 'just a string' });
  });
});
