import { describe, expect, it } from 'vitest';

import { DualClassRequests } from '../../src/dualclass/DualClassRequests.js';
import type {
  DualClassPorts,
  LoadedClass,
  PendingDualClass,
} from '../../src/dualclass/DualClassRequests.js';
import type { DualClassResult } from '../../src/dualclass/dualClassRequest.js';
import { fighter, wizard } from './support/dualClasses.js';

/** The GM's browser answering dual class requests. 2026-10-12. */
const FIGHTER = 'Compendium.pf2e.classes.Item.F';
const WIZARD = 'Compendium.pf2e.classes.Item.W';
const CLASSES: Record<string, LoadedClass> = {
  [FIGHTER]: { ...fighter(), type: 'class' },
  [WIZARD]: { ...wizard(), type: 'class' },
};

function world(overrides: Partial<DualClassPorts> = {}, request = {}) {
  const answers: { userId: string; result: DualClassResult }[] = [];
  const told: string[] = [];
  let pending: PendingDualClass[] = [
    {
      userId: 'u1',
      userName: 'Lai',
      request: { id: 'r1', actorId: 'A1', first: FIGHTER, second: WIZARD, at: 1, ...request },
    },
  ];
  const ports: DualClassPorts = {
    isDesignatedGm: () => true,
    pending: () => pending,
    sheet: (actorId, userId) =>
      actorId === 'A1' ? { name: 'Kibwe', owned: userId === 'u1' } : null,
    packPresent: (key) => key === 'pf2e.classes',
    loadClass: async (uuid) => Promise.resolve(CLASSES[uuid] ?? null),
    img: () => 'systems/pf2e/icons/spells/guidance.webp',
    answer: async (userId, result) => {
      answers.push({ userId, result });
      pending = pending.filter((user) => user.userId !== userId);
      return Promise.resolve();
    },
    tellGm: (text) => told.push(text),
    ...overrides,
  };
  return { requests: new DualClassRequests(ports), answers, told };
}

const refusal = async (overrides: Partial<DualClassPorts> = {}, request = {}) => {
  const { requests, answers, told } = world(overrides, request);
  await requests.serve();
  expect(told).toEqual([]);
  const result = answers[0]?.result;
  return result?.kind === 'refused' ? result.reason : `not refused: ${JSON.stringify(result)}`;
};

describe('serving a request', () => {
  it('builds the dual class, answers the player with it and tells the GM', async () => {
    const { requests, answers, told } = world();
    await requests.serve();
    expect(told).toEqual(["Tongs gave Lai's Kibwe the Fighter - Wizard dual class."]);
    expect(answers).toHaveLength(1);
    const result = answers[0]?.result;
    expect(answers[0]?.userId).toBe('u1');
    expect(result).toMatchObject({ kind: 'built', requestId: 'r1', actorId: 'A1' });
    if (result?.kind !== 'built') throw new Error('not built');
    expect(result.item).toMatchObject({
      name: 'Fighter - Wizard',
      type: 'class',
      img: 'systems/pf2e/icons/spells/guidance.webp',
      flags: { 'tongs-browser': { dualClassFor: 'r1' } },
    });
    expect(result.item.system['hp']).toBe(10);
  });

  it('does nothing unless this browser is the designated GM', async () => {
    const { requests, answers, told } = world({ isDesignatedGm: () => false });
    await requests.serve();
    expect(answers).toEqual([]);
    expect(told).toEqual([]);
  });

  /** ⛔ The answer fires updateUser, which calls serve again while the first pass is still awaiting. */
  it('runs one pass at a time, and a call made mid-pass becomes one more pass after it', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let loads = 0;
    const { requests, answers } = world({
      loadClass: async (uuid) => {
        loads += 1;
        await gate;
        return CLASSES[uuid] ?? null;
      },
    });
    const first = requests.serve();
    await Promise.resolve();
    const second = requests.serve();
    release();
    await Promise.all([first, second]);
    expect(answers).toHaveLength(1);
    expect(loads).toBe(2);
  });

  it('serves again after a pass that failed', async () => {
    let fail = true;
    const { requests, answers } = world({
      loadClass: async (uuid) => {
        if (fail) throw new Error('compendium offline');
        return Promise.resolve(CLASSES[uuid] ?? null);
      },
    });
    await expect(requests.serve()).rejects.toThrow('compendium offline');
    fail = false;
    await requests.serve();
    expect(answers).toHaveLength(1);
  });
});

describe('refusing a request, with the reason, and the GM not bothered', () => {
  it('refuses a sheet that is not in the world', async () => {
    expect(await refusal({}, { actorId: 'GONE' })).toBe(
      'That character sheet is not in this world any more.'
    );
  });

  it('refuses a sheet the asker does not own', async () => {
    expect(await refusal({ sheet: () => ({ name: 'Kibwe', owned: false }) })).toBe(
      'You can only give a dual class to a character sheet you own.'
    );
  });

  it('refuses a sheet that already has a dual class, the community macro’s included', async () => {
    const sheet = () => ({ name: 'Kibwe', owned: true, dualClass: 'Rogue - Bard' });
    expect(await refusal({ sheet })).toBe(
      'Kibwe already has a dual class (Rogue - Bard), so Tongs did not add another.'
    );
  });

  it('refuses the same class twice, by UUID', async () => {
    expect(await refusal({}, { second: FIGHTER })).toMatch(/same class twice/);
  });

  it('refuses the same class twice from two packs, by name', async () => {
    const other = 'Compendium.pf2e-playtest-data.battlecry-playtest-classes.Item.F';
    expect(
      await refusal(
        {
          packPresent: () => true,
          loadClass: async () => Promise.resolve({ ...fighter(), type: 'class' }),
        },
        { second: other }
      )
    ).toMatch(/same class twice/);
  });

  it('refuses a class from a compendium that is not a class compendium Tongs reads', async () => {
    expect(await refusal({}, { first: 'Compendium.world.homebrew.Item.X' })).toBe(
      'That class is not from a class compendium Tongs reads.'
    );
    expect(await refusal({}, { second: 'Actor.A1' })).toBe(
      'That class is not from a class compendium Tongs reads.'
    );
  });

  it('refuses a class from a listed compendium this world does not have', async () => {
    expect(await refusal({}, { second: 'Compendium.sf2e.classes.Item.S' })).toBe(
      'This world does not have the sf2e.classes compendium any more.'
    );
  });

  it('refuses a class that cannot be found, or is not a class', async () => {
    const unknown = 'Compendium.pf2e.classes.Item.NOPE';
    const why = "Tongs could not find that class in this world's compendiums.";
    expect(await refusal({}, { first: unknown })).toBe(why);
    expect(
      await refusal({
        loadClass: async (uuid) =>
          Promise.resolve(
            uuid === WIZARD ? { ...wizard(), type: 'feat' } : (CLASSES[uuid] ?? null)
          ),
      })
    ).toBe(why);
  });
});
