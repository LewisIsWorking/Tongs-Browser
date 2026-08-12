import { describe, expect, it, vi } from 'vitest';

import {
  openCharacterSheet,
  resolveCharacterSheet,
  type CharacterSources,
  type SheetOwner,
} from '../../src/foundry/CharacterSheet.js';

/**
 * Which actor "my character" means.
 *
 * The ORDER is the whole content of this, and it is the part worth protecting: the assigned
 * character, then a controlled token's actor, then the only actor they own. Each step earns its
 * place, and the last one is capped at exactly one on purpose.
 */
const withSheet = (extra: Partial<SheetOwner> = {}): SheetOwner => ({
  sheet: { render: vi.fn() },
  ...extra,
});

const sources = (overrides: Partial<CharacterSources> = {}): CharacterSources => ({
  assigned: () => null,
  controlled: () => null,
  allActors: () => [],
  ...overrides,
});

describe('resolveCharacterSheet', () => {
  /** What the user explicitly nominated wins over anything inferred. */
  it('prefers the assigned character over a controlled token', () => {
    const assigned = withSheet();
    const controlled = withSheet();

    expect(
      resolveCharacterSheet(sources({ assigned: () => assigned, controlled: () => controlled }))
    ).toBe(assigned);
  });

  /**
   * On a phone, selecting a token and then asking for its sheet is the natural flow: double tapping
   * a token accurately is fiddly, which is the problem this whole module exists for.
   */
  it("falls back to the controlled token's actor", () => {
    const controlled = withSheet();

    expect(resolveCharacterSheet(sources({ controlled: () => controlled }))).toBe(controlled);
  });

  it('falls back to the only actor the user owns', () => {
    const mine = withSheet({ isOwner: true });
    const theirs = withSheet({ isOwner: false });

    expect(resolveCharacterSheet(sources({ allActors: () => [theirs, mine] }))).toBe(mine);
  });

  /**
   * ⚠️ Exactly one, never a guess between several. A wrong sheet is worse than no sheet: it looks
   * like the button worked, so the user acts on the wrong character rather than trying again.
   */
  it('refuses to guess when the user owns more than one actor', () => {
    const first = withSheet({ isOwner: true });
    const second = withSheet({ isOwner: true });

    expect(resolveCharacterSheet(sources({ allActors: () => [first, second] }))).toBeNull();
  });

  it('returns nothing when there is nothing to open', () => {
    expect(resolveCharacterSheet(sources())).toBeNull();
  });

  /** An actor with no renderable sheet is not a candidate, so the search continues past it. */
  it('skips a candidate whose sheet cannot render', () => {
    const brokenAssigned = { sheet: {} };
    const controlled = withSheet();

    expect(
      resolveCharacterSheet(
        sources({ assigned: () => brokenAssigned, controlled: () => controlled })
      )
    ).toBe(controlled);
  });
});

describe('openCharacterSheet', () => {
  it('renders the sheet and reports success', () => {
    const render = vi.fn();

    const opened = openCharacterSheet(sources({ assigned: () => ({ sheet: { render } }) }));

    expect(opened).toBe(true);
    // force: true, because the sheet may already exist but be closed.
    expect(render).toHaveBeenCalledWith(true);
  });

  /**
   * Reporting failure is what lets the caller say something useful. A silent no op would leave the
   * user tapping a button that does nothing, with no clue that assigning a character would fix it.
   */
  it('reports failure rather than failing silently', () => {
    expect(openCharacterSheet(sources())).toBe(false);
  });
});
