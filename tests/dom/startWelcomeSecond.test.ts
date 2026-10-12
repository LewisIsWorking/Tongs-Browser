import { afterEach, describe, expect, it } from 'vitest';

import { startWelcome } from '../../src/welcome/startWelcome.js';
import { player, welcomeText } from './support/welcomePlayer.js';

/**
 * A second sheet, offered to a player ComeOnOverUno granted one. 2026-10-12.
 *
 * Lewis: "a maximum of 1 additional sheet if they already have 1 sheet ... (maximum 2 in total)".
 */
afterEach(() => {
  document.body.replaceChildren();
});

const sheet = (uuid: string, flags: Record<string, unknown> = {}) => ({
  uuid,
  type: 'character',
  isOwner: true,
  getFlag: (_scope: string, key: string) => flags[key],
});
const companion = sheet('Actor.C', { companionOf: 'Actor.A', companionKind: 'animal-companion' });

describe('a second sheet', () => {
  it('is offered, saying it is their second, to a player with one sheet and a grant', () => {
    const t = player();
    t.user.id = 'LaiLaiLaiLaiLai1';
    t.values['extraSheets'] = { LaiLaiLaiLaiLai1: 1 };
    t.actors.push(sheet('Actor.A'));
    startWelcome(t.hooks, t.settings, t.globals, document);
    expect(welcomeText()).toContain('A second character in Riddleport');
    expect(welcomeText()).toContain('Your first stays exactly as it is.');
  });

  it('is not offered without a grant, nor at two sheets', () => {
    const t = player();
    t.actors.push(sheet('Actor.A'));
    startWelcome(t.hooks, t.settings, t.globals, document);
    expect(welcomeText()).toBeNull();

    const full = player();
    full.user.id = 'LaiLaiLaiLaiLai1';
    full.values['extraSheets'] = { LaiLaiLaiLaiLai1: 1 };
    full.actors.push(sheet('Actor.A'), sheet('Actor.B'));
    startWelcome(full.hooks, full.settings, full.globals, document);
    expect(welcomeText()).toBeNull();
  });

  it("never counts a companion's sheet, so a new player with only a companion is still welcomed", () => {
    const t = player();
    (t.user as { id?: string | undefined }).id = undefined;
    t.actors.push(companion);
    startWelcome(t.hooks, t.settings, t.globals, document);
    expect(welcomeText()).toContain('Welcome to Riddleport!');
  });
});
