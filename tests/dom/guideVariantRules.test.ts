import { afterEach, describe, expect, it, vi } from 'vitest';

import { startWelcome } from '../../src/welcome/startWelcome.js';
import { DUAL_CLASS_EVENT } from '../../src/dualclass/startDualClassPlayer.js';
import { PARAGON_NOTE } from '../../src/welcome/variantSteps.js';
import { player, press } from './support/welcomePlayer.js';
import { settle, table } from './support/dualClassWorld.js';

/** The checklist beside a new sheet, in a world with variant rules on. 2026-10-20. */
afterEach(() => {
  document.body.replaceChildren();
});

const guideText = () => document.querySelector('#tongs-build-guide')?.textContent ?? '';
const item = (type: string, extra: Record<string, unknown>, dualFor?: string) => ({
  id: type,
  type,
  ...extra,
  getFlag: (_scope: string, key: string) => (key === 'dualClassFor' ? dualFor : undefined),
});

function world(rules: Record<string, boolean>) {
  const t = player();
  Object.assign(t.values, rules);
  const items: ReturnType<typeof item>[] = [];
  t.actors.push({
    id: 'NEW',
    uuid: 'Actor.NEW',
    name: 'Theo',
    type: 'character',
    isOwner: true,
    items: { contents: items },
    getFlag: (_scope: string, key: string) => (key === 'madeForRequest' ? 'r1' : undefined),
  });
  return { ...t, items };
}

describe('the checklist’s variant rule steps', () => {
  it('shows none of them with every rule off', () => {
    const t = world({});
    startWelcome(t.hooks, t.settings, t.globals, document);
    expect(guideText()).toContain('Building Theo');
    expect(guideText()).not.toContain('dual class');
    expect(guideText()).not.toContain('Ancestry Paragon');
    expect(guideText()).not.toContain('Free Archetype');
  });

  it('shows each rule that is on, saying it adds slots', () => {
    const t = world({ legacyVariantRuleAncestryParagon: true, freeArchetypeVariant: true });
    startWelcome(t.hooks, t.settings, t.globals, document);
    expect(guideText()).toContain('Ancestry Paragon');
    expect(guideText()).toContain(PARAGON_NOTE);
    expect(guideText()).toContain('Free Archetype');
    expect(guideText()).toContain('From level 2');
    expect(guideText()).not.toContain('Pick your dual class');
  });

  it('ticks Ancestry Paragon once a feat is in its section', () => {
    const t = world({ legacyVariantRuleAncestryParagon: true });
    startWelcome(t.hooks, t.settings, t.globals, document);
    t.items.push(
      item('feat', { name: 'Natural Ambition', system: { location: 'xdy_ancestryparagon-1' } })
    );
    t.change();
    expect(guideText()).toContain('✓Ancestry Paragon1 feat');
    expect(guideText()).not.toContain(PARAGON_NOTE);
  });

  it('opens the Dual class window on this sheet, and ticks once it has one', () => {
    const t = world({ legacyVariantRuleDualClass: true });
    const heard = vi.fn();
    document.addEventListener(DUAL_CLASS_EVENT, heard);
    startWelcome(t.hooks, t.settings, t.globals, document);
    expect(guideText()).toContain('•Pick your dual class');
    press('Pick two classes');
    expect((heard.mock.calls[0]?.[0] as CustomEvent).detail).toEqual({ actorId: 'NEW' });
    document.removeEventListener(DUAL_CLASS_EVENT, heard);

    t.items.push(item('class', { name: 'Fighter - Wizard' }, 'd1'));
    t.change();
    expect(guideText()).toContain('✓Pick your dual classFighter - Wizard');
    expect(document.querySelector('#tongs-build-guide li button')).toBeNull();
  });
});

describe('the Dual class window opened from the checklist', () => {
  it('starts on the sheet it was opened for, and ignores a sheet that is not the player’s', async () => {
    const world = table();
    world.doc.dispatchEvent(new CustomEvent(DUAL_CLASS_EVENT, { detail: { actorId: 'A2' } }));
    await settle();
    const sheet = () => world.doc.getElementById('tongs-dual-class-sheet') as HTMLSelectElement;
    expect(sheet().value).toBe('A2');
    world.doc.dispatchEvent(new CustomEvent(DUAL_CLASS_EVENT, { detail: { actorId: 'X' } }));
    await settle();
    expect(sheet().value).toBe('A1');
  });
});
