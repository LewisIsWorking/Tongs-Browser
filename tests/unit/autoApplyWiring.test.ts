import { describe, expect, it, vi } from 'vitest';

import { buildAutoApply } from '../../src/automation/buildAutoApply.js';
import { recentStrikeMessages, RECENT_LIMIT } from '../../src/automation/recentStrikeMessages.js';
import {
  AUTO_APPLY_SETTING,
  registerAutoApplySetting,
  startAutoApply,
} from '../../src/automation/startAutoApply.js';
import { logger } from '../../src/core/Logger.js';
import type { RollDeck } from '../../src/deck/RollDeck.js';

/**
 * The automation's reach into the chat log, its world setting and its hooks. Written 2026-09-14.
 */
describe('the recent chat log', () => {
  const log = (count: number, visible = true) =>
    Array.from({ length: count }, (_, i) => ({ id: `m${String(i)}`, timestamp: i, visible }));

  /** ⛔ On the document boundary: a player's browser reads nothing. */
  it('gives a player nothing, and a GM only visible messages', () => {
    const messages = [
      ...log(2),
      { id: 'hidden', timestamp: 9, visible: false },
      { id: 'silent', timestamp: 10 },
    ];

    expect(
      recentStrikeMessages({ game: { user: { isGM: false }, messages: { contents: messages } } })
    ).toEqual([]);
    expect(
      recentStrikeMessages({
        game: { user: { isGM: true }, messages: { contents: messages } },
      }).map((m) => m.id)
    ).toEqual(['m0', 'm1']);
  });

  it('keeps only the most recent messages, oldest first', () => {
    const recent = recentStrikeMessages({
      game: { user: { isGM: true }, messages: { contents: log(RECENT_LIMIT + 5) } },
    });

    expect(recent).toHaveLength(RECENT_LIMIT);
    expect(recent[0]?.id).toBe('m5');
  });

  it('is empty with no chat log', () => {
    expect(recentStrikeMessages({ game: { user: { isGM: true } } })).toEqual([]);
  });
});

describe('the world setting', () => {
  /** ⛔ Off until a GM turns it on, for the whole world: a release must never start applying damage. */
  it('registers as a world setting, off by default', () => {
    const register = vi.fn();

    registerAutoApplySetting({ register, get: () => undefined });

    expect(register).toHaveBeenCalledWith(
      'tongs-browser',
      AUTO_APPLY_SETTING,
      expect.objectContaining({ scope: 'world', default: false, type: Boolean, config: true })
    );
  });
});

const setupWith = (enabled: boolean) => {
  const handlers = new Map<string, (...args: unknown[]) => void>();
  const hooks = {
    on(this: unknown, name: string, fn: (...args: never[]) => unknown) {
      handlers.set(name, fn as (...args: unknown[]) => void);
      return handlers.size;
    },
  };
  const settings = { register: vi.fn(), get: vi.fn(() => enabled) };
  const recent = vi.fn(() => []);
  const globals = {
    game: {
      user: { id: 'gm', role: 4, isGM: true },
      users: { activeGM: { id: 'gm', role: 4 } },
      system: { id: 'pf2e' },
      messages: {
        get contents() {
          return recent();
        },
      },
    },
  };
  startAutoApply({} as RollDeck, hooks, settings, globals);
  return { handlers, settings, recent };
};

describe('the hooks', () => {
  const setup = setupWith;

  it('listens for new messages, scene changes and users connecting', () => {
    const { handlers } = setup(false);

    expect([...handlers.keys()].sort()).toEqual([
      'canvasReady',
      'createChatMessage',
      'userConnected',
    ]);
  });

  /** ⚠️ The setting is read on each event, so switching it on works without a reload. */
  it('does nothing while the setting is off, and catches up when it is on', () => {
    const off = setup(false);
    off.handlers.get('canvasReady')?.();
    off.handlers.get('userConnected')?.();
    off.handlers.get('createChatMessage')?.({ id: 'x', timestamp: 1 });
    expect(off.recent).not.toHaveBeenCalled();

    const on = setup(true);
    expect(on.recent).toHaveBeenCalled();
    on.recent.mockClear();
    on.handlers.get('canvasReady')?.();
    expect(on.recent).toHaveBeenCalled();
  });
});

describe('when switched on', () => {
  it('handles new messages and connecting users, and logs a failure instead of throwing', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const { handlers, recent } = setupWith(true);
    recent.mockImplementationOnce(() => {
      throw new Error('chat log unavailable');
    });
    recent.mockImplementationOnce(() => {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- a non-Error rejection is the case
      throw 'socket closed';
    });

    handlers.get('userConnected')?.();
    handlers.get('canvasReady')?.();
    handlers.get('createChatMessage')?.({ id: 'x', timestamp: 1 });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('chat log unavailable'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('socket closed'));
    warn.mockRestore();
  });
});

describe('with an empty world', () => {
  /** Every port answers safely when Foundry has nothing to give, rather than throwing mid-game. */
  it('answers every question without throwing', async () => {
    const ports = buildAutoApply({}, {} as RollDeck);
    const card = { id: 'x', timestamp: 1 };

    expect(ports.role()).toBe('queue');
    expect(ports.myUserId()).toBeNull();
    expect(ports.systemId()).toBe('');
    expect(ports.recentMessages()).toEqual([]);
    expect(ports.flag(card, 'handled')).toBeUndefined();
    expect(ports.isHandled(card)).toBe(false);
    expect(ports.attackerIsPlayers('A')).toBe(false);
    expect(ports.targetState('Scene.S.Token.X')).toMatchObject({ elsewhere: true, exists: false });
    await expect(ports.setFlag('x', 'pending', true)).resolves.toBeUndefined();
    await expect(ports.unsetFlag('x', 'pending')).resolves.toBeUndefined();
    const damage = {
      ...card,
      actorId: 'A',
      itemUuid: 'W',
      targetToken: 'Scene.S.Token.X',
      outcome: 'success',
      authorId: null,
      strikeIndex: 0,
      formula: 'f',
      total: 1,
      min: 1,
      max: 1,
    };
    expect(await ports.recomputeFormula(damage, 'a1')).toBeNull();
    expect(await ports.recomputeFormula({ ...damage, targetToken: null }, 'a1')).toBeNull();
    expect(
      await ports.recomputeFormula({ ...damage, targetToken: 'not a token' }, 'a1')
    ).toBeNull();
  });
});
