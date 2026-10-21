import { afterEach, describe, expect, it } from 'vitest';

import { LATER_FLAG } from '../../src/welcome/sheetLimit.js';
import { startWelcome } from '../../src/welcome/startWelcome.js';
import { player, press, welcomeText } from './support/welcomePlayer.js';

/**
 * A second sheet, offered to a player with a /extrasheet grant. 2026-10-12. Lewis, 2026-10-21: every
 * player gets one sheet; /extrasheet makes it 2, and 2 is the most. Companion and familiar classes add
 * nothing, and companion sheets never count.
 */
afterEach(() => {
  document.body.replaceChildren();
});

const LAI = 'LaiLaiLaiLaiLai1';
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

/** A player who sent /extrasheet. */
function granted() {
  const t = player();
  t.user.id = LAI;
  t.values['extraSheets'] = { [LAI]: 1 };
  return t;
}

describe('a second sheet', () => {
  it('is not offered to a player with one sheet and no grant', () => {
    const t = player();
    t.actors.push(sheet('Actor.A'));
    startWelcome(t.hooks, t.settings, t.globals, document);
    expect(welcomeText()).toBeNull();
  });

  it('is not offered without a grant even when the sheet grants a familiar', () => {
    const t = player();
    t.actors.push(witch);
    startWelcome(t.hooks, t.settings, t.globals, document);
    expect(welcomeText()).toBeNull();
  });

  it('is offered, saying it is the second, to a player with one sheet and a grant', () => {
    const t = granted();
    t.actors.push(sheet('Actor.A'));
    startWelcome(t.hooks, t.settings, t.globals, document);
    expect(welcomeText()).toContain('A second character in Riddleport');
    expect(welcomeText()).toContain('Your first stays exactly as it is.');
  });

  it('is never offered at two sheets, grant or familiar', () => {
    const t = granted();
    t.actors.push(witch, sheet('Actor.B'));
    startWelcome(t.hooks, t.settings, t.globals, document);
    expect(welcomeText()).toBeNull();
  });

  it("never counts a companion's sheet, so a new player with only a companion is still welcomed", () => {
    const t = player();
    (t.user as { id?: string | undefined }).id = undefined;
    t.actors.push(companion);
    startWelcome(t.hooks, t.settings, t.globals, document);
    expect(welcomeText()).toContain('Welcome to Riddleport!');
  });

  it('remembers Not now on a second character, until the allowance or the sheets change', () => {
    const t = granted();
    t.actors.push(sheet('Actor.X'));
    startWelcome(t.hooks, t.settings, t.globals, document);
    expect(welcomeText()).toContain('A second character in Riddleport');
    press('Not now');
    expect(t.user.setFlag).toHaveBeenCalledWith('tongs-browser', LATER_FLAG, '1/2');
    document.body.replaceChildren();

    /* The next page load: still said no. */
    const again = granted();
    again.userFlags[LATER_FLAG] = '1/2';
    again.actors.push(sheet('Actor.X'));
    startWelcome(again.hooks, again.settings, again.globals, document);
    expect(welcomeText()).toBeNull();
    document.body.replaceChildren();

    /* A Not now kept from other numbers (v0.61.0 counted 2 each) asks once more. */
    const stale = granted();
    stale.userFlags[LATER_FLAG] = '1/3';
    stale.actors.push(sheet('Actor.X'));
    startWelcome(stale.hooks, stale.settings, stale.globals, document);
    expect(welcomeText()).toContain('A second character in Riddleport');
  });

  it('never remembers Not now on a first sheet', () => {
    const t = player();
    startWelcome(t.hooks, t.settings, t.globals, document);
    press('Not now');
    expect(t.user.setFlag).not.toHaveBeenCalled();
  });

  it('never remembers Not now on a refusal, even for a player with a sheet', () => {
    const t = player();
    t.actors.push(sheet('Actor.X'));
    t.userFlags['sheetResult'] = { kind: 'refused', requestId: 'r0', reason: 'Foundry said no.' };
    startWelcome(t.hooks, t.settings, t.globals, document);
    expect(welcomeText()).toContain('Foundry said no.');
    press('Not now');
    expect(t.user.setFlag).not.toHaveBeenCalled();
  });
});
