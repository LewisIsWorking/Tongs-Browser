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
  saveControls: (content: string) =>
    content.includes('spell-save')
      ? [{ statistic: 'will' as const, dc: 17, control: 'spell-save' as const, index: 0 }]
      : [],
});

describe('a measured PF2e damage message', () => {
  it('reads the damage, its types and its target', () => {
    const facts = readMessageFacts(measured(), ports());

    expect(facts.damage).toEqual([
      { rollIndex: 0, total: 6, types: ['piercing', 'fire'], amounts: { full: 6, healing: 6 } },
    ]);
    expect(facts.target).toEqual({ tokenUuid: TOKEN, name: 'Xorn' });
    expect(facts.handled).toBe(false);
  });

  it('asks for no save when it has no content', () => {
    expect(readMessageFacts(measured(), ports()).saves).toEqual([]);
  });

  it('reads saves from the stored content, through the port', () => {
    const cast = measured('pf2e', { content: '<button data-action="spell-save">' });

    expect(readMessageFacts(cast, ports()).saves).toEqual([
      { statistic: 'will', dc: 17, control: 'spell-save', index: 0 },
    ]);
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

  it('is empty for a damage roll that carries no rolls or no instances', () => {
    const bare: MessageLike = { id: 'msg2', timestamp: 1, isDamageRoll: true };
    const hollow = measured('pf2e', { rolls: [{ total: 4, instances: [] }] });

    expect(readMessageFacts(bare, ports()).damage).toEqual([]);
    expect(readMessageFacts(hollow, ports()).damage).toEqual([]);
  });

  /** An untyped instance still counts as damage; it just names no type, and a missing total reads 0. */
  it('keeps an untyped instance as damage without inventing a type', () => {
    const untyped = measured('pf2e', { rolls: [{ instances: [{}] }] });

    expect(readMessageFacts(untyped, ports()).damage).toEqual([
      { rollIndex: 0, total: 0, types: [], amounts: { full: 0, healing: 0 } },
    ]);
  });

  /** ⚠️ PF2e's apply takes a `rollIndex`, so a skipped roll must not renumber the ones after it. */
  it('keeps PF2e roll numbering when a roll without damage is skipped', () => {
    const mixed = measured('pf2e', {
      rolls: [{ total: 15 }, { total: 6, instances: [{ type: 'fire' }] }],
    });

    expect(readMessageFacts(mixed, ports()).damage).toEqual([
      { rollIndex: 1, total: 6, types: ['fire'], amounts: { full: 6, healing: 6 } },
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

  it("reads the automation's note, and nothing when there is none", () => {
    const noted = measured('pf2e', {
      flags: { 'tongs-browser': { autoDeclined: 'the attack did not hit' } },
    });

    expect(readMessageFacts(noted, ports()).note).toBe('the attack did not hit');
    expect(readMessageFacts(measured(), ports()).note).toBeUndefined();
  });

  it('does not treat a truthy non-boolean as handled', () => {
    const odd = measured('pf2e', {
      flags: { ...measured().flags, 'tongs-browser': { handled: 'yes' } },
    });

    expect(readMessageFacts(odd, ports()).handled).toBe(false);
  });
});

describe('who and what', () => {
  it("reads the speaker and the item's name", () => {
    const facts = readMessageFacts(
      measured('pf2e', { alias: 'Fire Mephit', item: { name: 'Jaws' } }),
      ports()
    );

    expect(facts.speaker).toBe('Fire Mephit');
    expect(facts.title).toBe('Jaws');
  });

  it('reads no item as no title, and no alias as an empty speaker', () => {
    const facts = readMessageFacts(measured('pf2e', { item: null }), ports());

    expect(facts.title).toBeNull();
    expect(facts.speaker).toBe('');
  });
});
