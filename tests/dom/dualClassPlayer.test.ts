import { afterEach, describe, expect, it } from 'vitest';

import { F, W, settle, table } from './support/dualClassWorld.js';

/** The player side, asking: the tray's event opens the window and the request is sent. 2026-10-12. */
afterEach(() => {
  document.body.innerHTML = '';
});

describe('opening the window from the tray', () => {
  it('asks which sheet and which classes', async () => {
    const world = table();
    await world.open();
    expect(world.text()).toContain('Dual class');
    const sheet = world.doc.getElementById('tongs-dual-class-sheet') as HTMLSelectElement;
    expect([...sheet.options].map((option) => option.textContent)).toEqual([
      'Kibwe',
      'A character',
    ]);
    expect(world.text()).toContain('Wizard');
  });

  it('sends the request on the player’s own user, after clearing an old answer', async () => {
    const world = table();
    await world.open();
    world.choose('second', W);
    world.press('Ask for this dual class');
    await settle();
    expect(world.me.unsetFlag).toHaveBeenCalledWith('tongs-browser', 'dualClassResult');
    expect(world.flags['dualClassRequest']).toMatchObject({
      id: 'r1',
      actorId: 'A1',
      first: F,
      second: W,
    });
    expect(world.text()).toContain('A GM is online');
  });

  it('makes up a request id where the browser has no randomUUID', async () => {
    const world = table({ crypto: false, gm: false });
    await world.open();
    world.choose('second', W);
    world.press('Ask for this dual class');
    expect(world.text()).toContain('the next time one is online');
    await settle();
    expect((world.flags['dualClassRequest'] as { id: string }).id).toMatch(/^\d+-/);
  });

  it('says a request is already on its way', async () => {
    const request = { id: 'r0', actorId: 'A1', first: F, second: W, at: 1 };
    const world = table({ flags: { dualClassRequest: request } });
    await world.open();
    expect(world.text()).toContain('Your dual class is on its way');
  });

  it('says so when the player has no sheet of their own, or there are no classes', async () => {
    const none = table({ sheets: 0 });
    await none.open();
    expect(none.text()).toContain('You have no character sheet of your own');
    const few = table({ classes: ['Fighter'] });
    await few.open();
    expect(few.text()).toContain('none of the class compendiums');
  });

  it('is never started in a GM’s browser', async () => {
    const world = table({ isGM: true });
    await world.open();
    expect(world.text()).toBe('');
    expect(world.hooks).toEqual({});
  });
});
