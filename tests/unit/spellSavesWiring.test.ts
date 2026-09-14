import { describe, expect, it, vi } from 'vitest';

import { readRecordedTargets, readSpellCast } from '../../src/automation/spellFacts.js';
import {
  SPELL_SAVES_SETTING,
  recordCastTargets,
  registerSpellSavesSetting,
  startSpellSaves,
} from '../../src/automation/startSpellSaves.js';
import type { SpellGlobals } from '../../src/automation/startSpellSaves.js';
import type { RollDeck } from '../../src/deck/RollDeck.js';
import { logger } from '../../src/core/Logger.js';

/**
 * Reading cast cards, recording the caster's targets, and the spell-saves setting and hooks. Written
 * 2026-09-14.
 */
const castFlags = { pf2e: { context: { type: 'spell-cast' }, origin: { uuid: 'Actor.C.Item.S' } } };

describe('reading a cast card', () => {
  it('reads a spell cast, and nothing else', () => {
    expect(
      readSpellCast({ id: 'c', timestamp: 3, speaker: { actor: 'C' }, flags: castFlags }, 'pf2e')
    ).toEqual({
      id: 'c',
      timestamp: 3,
      actorId: 'C',
      spellUuid: 'Actor.C.Item.S',
    });
    expect(
      readSpellCast({ id: 'c', timestamp: 3, speaker: { actor: 'C' }, flags: castFlags }, 'sf2e')
    ).toBeNull();
    expect(readSpellCast({ id: 'c', timestamp: 3, flags: castFlags }, 'pf2e')).toBeNull();
  });

  it('reads recorded targets, ignoring anything that is not a uuid string', () => {
    const card = {
      id: 'c',
      timestamp: 1,
      flags: { 'tongs-browser': { targets: ['Scene.S.Token.A', 7, null] } },
    };

    expect(readRecordedTargets(card, 'tongs-browser')).toEqual(['Scene.S.Token.A']);
    expect(readRecordedTargets({ id: 'c', timestamp: 1 }, 'tongs-browser')).toEqual([]);
  });
});

describe("recording the caster's targets", () => {
  const world = (
    activeGM: { id: string; role: number } | null,
    targets: string[]
  ): SpellGlobals => ({
    game: {
      user: { id: 'p', role: 1, targets: targets.map((uuid) => ({ document: { uuid } })) },
      users: { activeGM },
      system: { id: 'pf2e' },
    },
  });
  const creating = (flags: Readonly<Record<string, unknown>> = castFlags) => ({
    id: 'c',
    timestamp: 1,
    flags,
    updateSource: vi.fn(),
  });

  it('writes the targets onto the card while it is created, queued when no GM is on', () => {
    const online = creating();
    recordCastTargets(online, 'p', world({ id: 'gm', role: 4 }, ['Scene.S.Token.A']));
    expect(online.updateSource).toHaveBeenCalledWith({
      flags: { 'tongs-browser': { targets: ['Scene.S.Token.A'] } },
    });

    const offline = creating();
    recordCastTargets(offline, 'p', world(null, ['Scene.S.Token.A']));
    expect(offline.updateSource).toHaveBeenCalledWith({
      flags: { 'tongs-browser': { targets: ['Scene.S.Token.A'], pending: true } },
    });
  });

  it("records nothing for someone else's message, a non-cast, or no targets", () => {
    for (const [message, userId, targets] of [
      [creating(), 'other', ['Scene.S.Token.A']],
      [creating({ pf2e: { context: { type: 'damage-roll' } } }), 'p', ['Scene.S.Token.A']],
      [creating(), 'p', []],
    ] as const) {
      recordCastTargets(message, userId, world(null, [...targets]));
      expect(message.updateSource).not.toHaveBeenCalled();
    }
  });
});

describe('the setting and the hooks', () => {
  it('registers a separate world setting, off by default', () => {
    const register = vi.fn();
    registerSpellSavesSetting({ register, get: () => undefined });
    expect(register).toHaveBeenCalledWith(
      'tongs-browser',
      SPELL_SAVES_SETTING,
      expect.objectContaining({ scope: 'world', default: false })
    );
  });

  it('records only while switched on, and logs a failure instead of throwing', async () => {
    const handlers = new Map<string, (...args: unknown[]) => void>();
    const hooks = {
      on(this: unknown, name: string, fn: (...args: never[]) => unknown) {
        handlers.set(name, fn as (...args: unknown[]) => void);
        return handlers.size;
      },
    };
    let enabled = false;
    const recent = vi.fn(() => []);
    const globals = {
      game: {
        user: { id: 'gm', role: 4, isGM: true, targets: [] },
        users: { activeGM: { id: 'gm', role: 4 } },
        system: { id: 'pf2e' },
        messages: {
          get contents() {
            return recent();
          },
        },
      },
    };
    startSpellSaves(
      {} as RollDeck,
      hooks,
      { register: vi.fn(), get: () => enabled },
      globals,
      {} as Document
    );
    expect([...handlers.keys()].sort()).toEqual([
      'canvasReady',
      'createChatMessage',
      'preCreateChatMessage',
      'userConnected',
    ]);

    const card = { id: 'c', timestamp: 1, flags: castFlags, updateSource: vi.fn() };
    handlers.get('preCreateChatMessage')?.(card, {}, {}, 'gm');
    expect(recent).not.toHaveBeenCalled();

    enabled = true;
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    recent.mockImplementationOnce(() => {
      throw new Error('log gone');
    });
    handlers.get('canvasReady')?.();
    handlers.get('userConnected')?.();
    handlers.get('createChatMessage')?.({ id: 'x', timestamp: 1 });
    handlers.get('preCreateChatMessage')?.(card, {}, {}, 'gm');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('log gone'));
    warn.mockRestore();
  });
});
