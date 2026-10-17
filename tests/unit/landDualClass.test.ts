import { describe, expect, it, vi } from 'vitest';

import { landDualClass } from '../../src/dualclass/landDualClass.js';
import type { LandingActor, LandingItem } from '../../src/dualclass/landDualClass.js';

/**
 * Putting the dual class on the sheet, in the player's browser, and leaving exactly one class. 2026-10-12.
 * The fake actor behaves as PF2e's does: creating a class deletes the class it already had.
 */
const ITEM = {
  name: 'Fighter - Wizard',
  type: 'class' as const,
  img: 'x',
  system: {},
  flags: { 'tongs-browser': { dualClassFor: 'r1' } },
};
const RESULT = { kind: 'built' as const, requestId: 'r1', actorId: 'A1', item: ITEM };

const classItem = (id: string, requestId?: string): LandingItem => ({
  id,
  type: 'class',
  getFlag: (scope, key) =>
    scope === 'tongs-browser' && key === 'dualClassFor' ? requestId : undefined,
});

function sheet(items: LandingItem[], options: { replaces?: boolean; refuses?: boolean } = {}) {
  const contents = [...items];
  const actor: LandingActor = {
    name: 'Kibwe',
    isOwner: true,
    items: { contents },
    createEmbeddedDocuments: vi.fn(async () => {
      if (options.refuses === true) return Promise.resolve([]);
      if (options.replaces !== false) {
        contents.splice(0, contents.length, ...contents.filter((item) => item.type !== 'class'));
      }
      contents.push(classItem('NEW', 'r1'));
      return Promise.resolve([{ id: 'NEW' }]);
    }),
    deleteEmbeddedDocuments: vi.fn(async (_type: string, ids: readonly string[]) => {
      contents.splice(
        0,
        contents.length,
        ...contents.filter((item) => !ids.includes(item.id ?? ''))
      );
      return Promise.resolve([]);
    }),
  };
  return { actor, contents };
}

describe('landing a dual class', () => {
  it('adds the item to the sheet, where PF2e replaces the old class', async () => {
    const { actor, contents } = sheet([classItem('OLD'), { id: 'F1', type: 'feat' }]);
    expect(await landDualClass(actor, RESULT)).toEqual({ kind: 'landed', actorName: 'Kibwe' });
    expect(actor.createEmbeddedDocuments).toHaveBeenCalledExactlyOnceWith('Item', [ITEM]);
    expect(actor.deleteEmbeddedDocuments).not.toHaveBeenCalled();
    expect(contents.map((item) => item.id)).toEqual(['F1', 'NEW']);
  });

  it('deletes an old class PF2e left behind, so exactly one class remains', async () => {
    const { actor, contents } = sheet([classItem('OLD')], { replaces: false });
    await landDualClass(actor, RESULT);
    expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledExactlyOnceWith('Item', ['OLD']);
    expect(contents.map((item) => item.id)).toEqual(['NEW']);
  });

  it('adds nothing when this request is already on the sheet (a reload, a second tab)', async () => {
    const { actor } = sheet([classItem('DONE', 'r1')]);
    expect(await landDualClass(actor, RESULT)).toEqual({ kind: 'already', actorName: 'Kibwe' });
    expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
  });

  /** ⚠️ Two tabs that both landed it keep the SAME copy, so they never delete each other's. */
  it('keeps the same one of two copies in every tab', async () => {
    const { actor, contents } = sheet([
      classItem('B2', 'r1'),
      classItem('A1', 'r1'),
      classItem('X'),
    ]);
    await landDualClass(actor, RESULT);
    expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledExactlyOnceWith('Item', ['B2', 'X']);
    expect(contents.map((item) => item.id)).toEqual(['A1']);
  });

  it('ignores items with no id, and names an unnamed sheet', async () => {
    const { actor } = sheet([{ id: null, type: 'class' }, classItem('Q', 'r1')]);
    const unnamed = { ...actor, name: null };
    expect(await landDualClass(unnamed, RESULT)).toEqual({
      kind: 'already',
      actorName: 'Your character',
    });
    expect(actor.deleteEmbeddedDocuments).not.toHaveBeenCalled();
  });

  /** ⚠️ A copy with no id is never the one kept, or every real copy would be deleted. */
  it('never keeps a copy with no id', async () => {
    const { actor, contents } = sheet([
      { ...classItem('Q', 'r1'), id: null },
      classItem('Q', 'r1'),
    ]);
    await landDualClass(actor, RESULT);
    expect(actor.deleteEmbeddedDocuments).not.toHaveBeenCalled();
    expect(contents).toHaveLength(2);
  });
});

describe('not landing it', () => {
  it('refuses a sheet that is missing or no longer the player’s', async () => {
    const why = { kind: 'failed', reason: 'That character sheet is not yours to change any more.' };
    expect(await landDualClass(undefined, RESULT)).toEqual(why);
    const { actor } = sheet([]);
    expect(await landDualClass({ ...actor, isOwner: false }, RESULT)).toEqual(why);
    expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
  });

  it('says so when PF2e would not add the class', async () => {
    const { actor } = sheet([classItem('OLD')], { refuses: true });
    expect(await landDualClass(actor, RESULT)).toEqual({
      kind: 'failed',
      reason: 'PF2e would not add the Fighter - Wizard class to Kibwe.',
    });
    expect(actor.deleteEmbeddedDocuments).not.toHaveBeenCalled();
  });
});
