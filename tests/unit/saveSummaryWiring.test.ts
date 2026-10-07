import { describe, expect, it, vi } from 'vitest';

import { logger } from '../../src/core/Logger.js';
import { buildSaveSummaryPorts, startSaveSummary } from '../../src/automation/startSaveSummary.js';
import type { SummaryGlobals } from '../../src/automation/startSaveSummary.js';

/** The saves card's Foundry side, and the caster's pop-up. Written 2026-10-07. */
const KRESKI = 'Scene.S.Token.K';
const summaryCard = (casterUserId: string) => ({
  id: 'card',
  timestamp: 5,
  visible: true,
  flags: {
    'tongs-browser': {
      saveSummary: { castId: 'c1', casterUserId, text: 'Daze: Kreski', taken: null },
    },
  },
});

const globalsWith = (over: object = {}) => {
  const update = vi.fn(() => Promise.resolve());
  const create = vi.fn(() => Promise.resolve());
  const info = vi.fn();
  const messages = [summaryCard('player'), { id: 'hidden', timestamp: 6, visible: false }];
  const globals = {
    game: {
      system: { id: 'pf2e' },
      user: { id: 'player', isGM: true, role: 4 },
      users: { activeGM: { id: 'player', role: 4 } },
      messages: {
        contents: messages,
        get: (id: string) => (id === 'card' ? { ...summaryCard('player'), update } : undefined),
      },
    },
    fromUuidSync: (uuid: string) => {
      if (uuid === 'broken') {
        throw new Error('no such document');
      }
      if (uuid === KRESKI) {
        return {
          uuid,
          name: 'Kreski',
          playersCanSeeName: true,
          actor: { system: { attributes: { hp: { value: 2, max: 16 } } } },
        };
      }
      return uuid === 'Actor.N.Item.Daze' ? { name: 'Daze' } : null;
    },
    ChatMessage: { create },
    ui: { notifications: { info } },
    ...over,
  } as unknown as SummaryGlobals;
  return { globals, update, create, info };
};

describe('the saves card in Foundry', () => {
  it('reads the world and writes the card', async () => {
    const { globals, update, create } = globalsWith();
    const ports = buildSaveSummaryPorts(globals);

    expect(ports.role()).toBe('act');
    expect(ports.systemId()).toBe('pf2e');
    expect(ports.recentMessages().map((each) => each.id)).toEqual(['card']);
    expect(ports.castMessage('card')?.id).toBe('card');
    expect(ports.castMessage('gone')).toBeNull();
    expect(['Actor.N.Item.Daze', 'gone', 'broken'].map(ports.spellName)).toEqual([
      'Daze',
      'the spell',
      'the spell',
    ]);
    expect(ports.target(KRESKI)).toEqual({ name: 'Kreski', band: null });
    expect(ports.target('broken')).toEqual({ name: 'The creature', band: null });

    const flags = { castId: 'c1', casterUserId: null, text: 't', taken: null };
    await ports.post('<p>card</p>', flags);
    await ports.edit('card', '<p>done</p>', flags);
    await ports.edit('gone', '<p>lost</p>', flags);
    expect(create).toHaveBeenCalledWith({
      content: '<p>card</p>',
      flags: { 'tongs-browser': { saveSummary: flags } },
    });
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('stands down with no world to read', () => {
    const ports = buildSaveSummaryPorts({});
    expect(ports.systemId()).toBe('');
    expect(ports.castMessage('card')).toBeNull();
  });
});

describe("the caster's pop-up", () => {
  const start = (globals: SummaryGlobals, on = true) => {
    const handlers = new Map<string, (message: unknown) => void>();
    startSaveSummary(
      {
        on: (name: string, fn: (...args: never[]) => unknown) => {
          handlers.set(name, fn as (message: unknown) => void);
          return 1;
        },
      },
      { get: () => on },
      globals
    );
    return (message: unknown) => handlers.get('createChatMessage')?.(message);
  };

  it('pops up for the caster alone, and stays until dismissed', () => {
    const { globals, info } = globalsWith();
    const fire = start(globals, false);

    fire(summaryCard('player'));
    fire(summaryCard('someone else'));
    fire({ id: 'other', timestamp: 1 });

    expect(info).toHaveBeenCalledTimes(1);
    expect(info).toHaveBeenCalledWith('Daze: Kreski', { permanent: true });

    /* A browser with no user yet (still loading) pops up nothing. */
    const { globals: loading, info: quiet } = globalsWith();
    Object.defineProperty(loading.game, 'user', { value: undefined });
    start(loading, false)(summaryCard('player'));
    expect(quiet).not.toHaveBeenCalled();
  });

  it('logs a failed card instead of throwing into Foundry', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    let throws: unknown = new Error('system gone');
    const { globals } = globalsWith();
    Object.defineProperty(globals.game, 'system', {
      get: () => {
        throw throws;
      },
    });
    const fire = start(globals);

    fire({ id: 's', timestamp: 1 });
    throws = 'plain';
    fire({ id: 's2', timestamp: 2 });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(warn).toHaveBeenCalledWith('Saves card failed: system gone');
    expect(warn).toHaveBeenCalledWith('Saves card failed: plain');
    warn.mockRestore();
  });
});
