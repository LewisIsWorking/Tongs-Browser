import { describe, expect, it } from 'vitest';

import {
  COMPANION_KINDS,
  companionKindOf,
  companionKindsFor,
  companionPackId,
} from '../../src/welcome/companionKinds.js';

/** What grants a companion, by PF2e's slugs. 2026-10-12. */
const kinds = (slugs: string[]) => companionKindsFor(slugs).map((each) => each.kind);

describe('detection by slug', () => {
  it('finds each kind by the feat or class feature that grants it', () => {
    expect(kinds(['familiar-witch', 'patron'])).toEqual(['familiar']);
    expect(kinds(['animal-order', 'animal-companion'])).toEqual(['animal-companion']);
    expect(kinds(['animal-companion-ranger'])).toEqual(['animal-companion']);
    expect(kinds(['eidolon', 'beast-eidolon'])).toEqual(['eidolon']);
    expect(kinds(['undead-master-dedication'])).toEqual(['undead-companion']);
    expect(kinds(['construct-innovation'])).toEqual(['construct-companion']);
    expect(kinds(['undead-familiar'])).toEqual(['familiar']);
    expect(kinds(['drone'])).toEqual(['drone']);
  });

  it('never by name, and not by feats that only change a companion already there', () => {
    expect(kinds(['Familiar', 'Animal Companion'])).toEqual([]);
    expect(
      kinds(['undead-companion', 'mature-animal-companion-druid', 'enhanced-familiar'])
    ).toEqual([]);
  });

  it('makes a pet its own companion only when there is no familiar (Familiar grants Pet)', () => {
    expect(kinds(['pet'])).toEqual(['pet']);
    expect(kinds(['familiar', 'pet'])).toEqual(['familiar']);
    expect(kinds(['familiar', 'animal-companion', 'eidolon'])).toEqual([
      'familiar',
      'animal-companion',
      'eidolon',
    ]);
  });

  it('gives familiars the familiar sheet and every other companion a character sheet', () => {
    for (const entry of COMPANION_KINDS) {
      expect(entry.actorType).toBe(
        entry.kind === 'familiar' || entry.kind === 'pet' ? 'familiar' : 'character'
      );
    }
  });

  it("names Companion Compendia's packs, with SF2e's sf- prefix", () => {
    expect(companionPackId('AC-Eidolons', 'pf2e')).toBe('pf2e-animal-companions.AC-Eidolons');
    expect(companionPackId('AC-Eidolons', 'sf2e')).toBe('pf2e-animal-companions.sf-AC-Eidolons');
    expect(companionPackId('AC-Eidolons', undefined)).toBe('pf2e-animal-companions.AC-Eidolons');
  });

  it('reads the kind only when both flags are there', () => {
    const flags = (values: Record<string, unknown>) => (_s: string, key: string) => values[key];
    expect(companionKindOf(flags({ companionOf: 'Actor.A', companionKind: 'pet' }), 'x')).toBe(
      'pet'
    );
    expect(companionKindOf(flags({ companionKind: 'pet' }), 'x')).toBeNull();
    expect(companionKindOf(undefined, 'x')).toBeNull();
  });
});
