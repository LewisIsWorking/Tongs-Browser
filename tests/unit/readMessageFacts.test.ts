import { describe, expect, it } from 'vitest';

import { readMessageFacts } from '../../src/deck/readMessageFacts.js';
import type { MessageLike } from '../../src/deck/readMessageFacts.js';

/**
 * Reading real chat messages into deck facts. Written 2026-09-13.
 *
 * ⛔ THE FIXTURE IS A MEASURED MESSAGE, not an invented one. Its shape was printed from a genuine strike
 * on pf2e 8.5.0 (a Fire Mephit's Jaws against a Xorn). Only the UUIDs are shortened.
 */
const TOKEN = 'Scene.hznk.Token.NOn5';

const measured = (flagsScope = 'pf2e', overrides: Partial<MessageLike> = {}): MessageLike => ({
  id: 'msg1',
  timestamp: 1_789_000_000_000,
  isDamageRoll: true,
  rolls: [
    {
      total: 6,
      instances: [{ type: 'piercing' }, { type: 'fire' }],
    },
  ],
  flags: {
    [flagsScope]: {
      context: {
        type: 'damage-roll',
        sourceType: 'attack',
        outcome: 'success',
        target: { actor: `${TOKEN}.Actor.Y2Fe`, token: TOKEN },
      },
    },
  },
  ...overrides,
});

const ports = (systemId = 'pf2e', names: Record<string, string> = { [TOKEN]: 'Xorn' }) => ({
  systemId,
  tokenName: (uuid: string) => names[uuid] ?? null,
});

describe('a measured PF2e damage message', () => {
  it('reads the damage, its types and its target', () => {
    const facts = readMessageFacts(measured(), ports());

    expect(facts.damage).toEqual([{ rollIndex: 0, total: 6, types: ['piercing', 'fire'] }]);
    expect(facts.target).toEqual({ tokenUuid: TOKEN, name: 'Xorn' });
    expect(facts.handled).toBe(false);
  });

  /** ⚠️ Saves are not read until a save-requesting message has been measured. */
  it('reports no save, since saves are not read yet', () => {
    expect(readMessageFacts(measured(), ports()).save).toBeNull();
  });
});

describe('the system namespace', () => {
  /**
   * ⛔ SF2e is PF2e's code with its flags under `sf2e`. Reading `flags.pf2e` by name would find no
   * target on every SF2e message, and every SF2e card would ask the GM to pick one.
   */
  it('finds the target under sf2e when the system is sf2e', () => {
    expect(readMessageFacts(measured('sf2e'), ports('sf2e')).target?.tokenUuid).toBe(TOKEN);
  });

  it('does not find it when told the wrong system, proving it reads the one it is given', () => {
    expect(readMessageFacts(measured('sf2e'), ports('pf2e')).target).toBeNull();
  });
});

describe('targets', () => {
  it('is null when the roll recorded no target', () => {
    const noTarget = measured('pf2e', { flags: { pf2e: { context: { type: 'damage-roll' } } } });

    expect(readMessageFacts(noTarget, ports()).target).toBeNull();
  });

  /**
   * ⛔ A token deleted since the roll must not become a button naming a creature that is not there. It
   * reads as no target, which asks the GM, rather than as a stale name.
   */
  it('is null when the recorded token no longer resolves', () => {
    expect(readMessageFacts(measured(), ports('pf2e', {})).target).toBeNull();
  });
});

describe('damage', () => {
  it('is empty for a message that is not a damage roll', () => {
    expect(readMessageFacts(measured('pf2e', { isDamageRoll: false }), ports()).damage).toEqual([]);
  });

  it('lists each damage type once, in the order the roll gives them', () => {
    const doubled = measured('pf2e', {
      rolls: [{ total: 9, instances: [{ type: 'fire' }, { type: 'slashing' }, { type: 'fire' }] }],
    });

    expect(readMessageFacts(doubled, ports()).damage[0]?.types).toEqual(['fire', 'slashing']);
  });

  /** ⚠️ PF2e's apply takes a `rollIndex`, so a skipped roll must not renumber the ones after it. */
  it('keeps PF2e roll numbering when a roll without damage is skipped', () => {
    const mixed = measured('pf2e', {
      rolls: [{ total: 15 }, { total: 6, instances: [{ type: 'fire' }] }],
    });

    expect(readMessageFacts(mixed, ports()).damage).toEqual([
      { rollIndex: 1, total: 6, types: ['fire'] },
    ]);
  });
});

describe('the handled marker', () => {
  /** ⛔ The one record both the deck and phase 2's automation check, so neither applies a hit twice. */
  it('reads a message marked handled by this module', () => {
    const handled = measured('pf2e', {
      flags: { ...measured().flags, 'tongs-browser': { handled: true } },
    });

    expect(readMessageFacts(handled, ports()).handled).toBe(true);
  });

  it('does not treat a truthy non-boolean as handled', () => {
    const odd = measured('pf2e', {
      flags: { ...measured().flags, 'tongs-browser': { handled: 'yes' } },
    });

    expect(readMessageFacts(odd, ports()).handled).toBe(false);
  });
});
