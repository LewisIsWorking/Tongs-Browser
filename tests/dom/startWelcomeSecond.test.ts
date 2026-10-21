import { afterEach, describe, expect, it } from 'vitest';

import { LATER_FLAG } from '../../src/welcome/sheetLimit.js';
import { startWelcome } from '../../src/welcome/startWelcome.js';
import { player, press, welcomeText } from './support/welcomePlayer.js';

/**
 * Another sheet, offered while a player is under their allowance. 2026-10-12, and since 2026-10-21 2 for
 * everyone, plus a /extrasheet grant, plus one per companion kind their sheets grant (Lewis: "the sheet
 * limit per person should be 2, if you have a companion class or a familiar class then +1 for each
 * instance of that").
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
const witch = {
  ...sheet('Actor.W'),
  items: { contents: [{ system: { slug: 'familiar-witch' } }] },
};

describe('another sheet', () => {
  it('is offered, saying it is another, to a player with one sheet and no grant', () => {
    const t = player();
    t.actors.push(sheet('Actor.A'));
    startWelcome(t.hooks, t.settings, t.globals, document);
    expect(welcomeText()).toContain('Another character in Riddleport');
    expect(welcomeText()).toContain('The ones you have stay exactly as they are.');
  });

  it('is not offered at two sheets without a grant or a companion', () => {
    const full = player();
    full.actors.push(sheet('Actor.A'), sheet('Actor.B'));
    startWelcome(full.hooks, full.settings, full.globals, document);
    expect(welcomeText()).toBeNull();
  });

  it('is offered at two sheets with a grant, and not at three', () => {
    const t = player();
    t.user.id = 'LaiLaiLaiLaiLai1';
    t.values['extraSheets'] = { LaiLaiLaiLaiLai1: 1 };
    t.actors.push(sheet('Actor.A'), sheet('Actor.B'));
    startWelcome(t.hooks, t.settings, t.globals, document);
    expect(welcomeText()).toContain('Another character in Riddleport');
    document.body.replaceChildren();

    const full = player();
    full.user.id = 'LaiLaiLaiLaiLai1';
    full.values['extraSheets'] = { LaiLaiLaiLaiLai1: 1 };
    full.actors.push(sheet('Actor.A'), sheet('Actor.B'), sheet('Actor.D'));
    startWelcome(full.hooks, full.settings, full.globals, document);
    expect(welcomeText()).toBeNull();
  });

  it('is offered at two sheets when one of them grants a familiar', () => {
    const t = player();
    t.actors.push(witch, sheet('Actor.B'));
    startWelcome(t.hooks, t.settings, t.globals, document);
    expect(welcomeText()).toContain('Another character in Riddleport');
  });

  it("never counts a companion's sheet, so a new player with only a companion is still welcomed", () => {
    const t = player();
    (t.user as { id?: string | undefined }).id = undefined;
    t.actors.push(companion);
    startWelcome(t.hooks, t.settings, t.globals, document);
    expect(welcomeText()).toContain('Welcome to Riddleport!');
  });
  it('remembers Not now on another character, until the allowance or the sheets change', () => {
    const t = player();
    t.actors.push({ uuid: 'Actor.X', type: 'character', isOwner: true });
    startWelcome(t.hooks, t.settings, t.globals, document);
    expect(welcomeText()).toContain('Another character in Riddleport');
    press('Not now');
    expect(t.user.setFlag).toHaveBeenCalledWith('tongs-browser', LATER_FLAG, '1/2');
    document.body.replaceChildren();

    /* The next page load: still said no. */
    const again = player();
    again.userFlags[LATER_FLAG] = '1/2';
    again.actors.push({ uuid: 'Actor.X', type: 'character', isOwner: true });
    startWelcome(again.hooks, again.settings, again.globals, document);
    expect(welcomeText()).toBeNull();

    /* A grant from /extrasheet asks once more. */
    again.user.id = 'LaiLaiLaiLaiLai1';
    again.values['extraSheets'] = { LaiLaiLaiLaiLai1: 1 };
    again.change();
    expect(welcomeText()).toContain('Another character in Riddleport');
  });

  it('never remembers Not now on a first sheet', () => {
    const t = player();
    startWelcome(t.hooks, t.settings, t.globals, document);
    press('Not now');
    expect(t.user.setFlag).not.toHaveBeenCalled();
  });
});
