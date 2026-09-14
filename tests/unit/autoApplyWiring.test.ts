import { describe, expect, it, vi } from 'vitest';

import { recentStrikeMessages, RECENT_LIMIT } from '../../src/automation/recentStrikeMessages.js';
import {
  AUTO_APPLY_SETTING,
  registerAutoApplySetting,
  startAutoApply,
} from '../../src/automation/startAutoApply.js';
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

describe('the hooks', () => {
  const setup = (enabled: boolean) => {
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
