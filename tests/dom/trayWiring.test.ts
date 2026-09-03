import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { FoundryActions } from '../../src/foundry/FoundryActions.js';
import type { VirtualPointer } from '../../src/pointer/VirtualPointer.js';
import {
  ANA,
  GAMEMASTER,
  clearWorld,
  findTrayAction as find,
  globals,
  parts,
  partyWorld,
} from './support/trayWiringWorld.js';

/**
 * The composition root for the tray. Written 2026-09-02.
 *
 * ⚠️ Nothing imported `wireTrayActions` before this file, so it was covered only incidentally, by
 * building the whole module. That is exactly the shape a composition root fails in: every part works,
 * every focused suite is green, and the wiring between them is what nobody looked at. The module
 * construction suite exists for the same reason, and records the regression that shipped a module
 * with no bar and no cursor.
 *
 * How a failure reaches the user lives in `trayWiringReporting.test.ts`, split out at the 200 line
 * limit.
 */
beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(clearWorld);

describe('who is offered the create button', () => {
  it('offers it to a GM', () => {
    globals['game'] = { user: { id: 'gm1', isGM: true } };

    expect(find('create-sheet')).toBeDefined();
  });

  /**
   * ⚠️ ABSENT for a player until the relay lands. They cannot create an actor without Foundry's
   * `ACTOR_CREATE` and cannot be handed ownership by anyone but a GM, so the button could only fail.
   */
  it('does not offer it to a player', () => {
    globals['game'] = { user: { id: 'p1', isGM: false } };

    expect(find('create-sheet')).toBeUndefined();
  });

  /** ⚠️ An unidentifiable viewer counts as a player, which is the safer of the two mistakes. */
  it('does not offer it before a user is known', () => {
    expect(find('create-sheet')).toBeUndefined();
  });
});

describe('tapping the create button', () => {
  /**
   * ⚠️ Reaches the FLOW, not merely a stub. A notice only appears if the wiring resolved the party
   * list, the viewer and the messages. A create button wired to nothing would leave the page
   * untouched and throw nothing at all.
   */
  it('puts the create flow on screen', () => {
    globals['game'] = { user: { id: 'gm1', isGM: true }, actors: [], users: [] };

    find('create-sheet')?.activate();

    expect(document.body.textContent).toContain('Ask your GM to make one');
  });

  /**
   * ⚠️ The world changes under a long lived button. A party created after the bar was built must be
   * offered, which a list captured at wiring time could never do.
   */
  it('reads the party list fresh on every tap, not once at build time', () => {
    globals['game'] = { user: { id: 'gm1', isGM: true }, actors: [], users: [] };
    const button = find('create-sheet');

    button?.activate();
    expect(document.body.textContent).toContain('Ask your GM to make one');

    document.body.innerHTML = '';
    partyWorld([GAMEMASTER, ANA]);

    button?.activate();

    expect(document.body.textContent).toContain('Whose character?');
  });

  it('does not throw when Foundry is not there at all', () => {
    globals['game'] = { user: { id: 'gm1', isGM: true } };
    const button = find('create-sheet');

    expect(() => {
      button?.activate();
    }).not.toThrow();
  });
});

describe('the buttons that were already there', () => {
  it('still wires the sidebar button', () => {
    globals['game'] = { user: { id: 'gm1', isGM: true } };
    const toggleFoundrySidebar = vi.fn();
    const wiring = { ...parts(), actions: { toggleFoundrySidebar } as unknown as FoundryActions };

    find('sidebar', wiring)?.activate();

    expect(toggleFoundrySidebar).toHaveBeenCalledOnce();
  });

  /** The grab button's release half, which nothing reached until this file existed. */
  it('still wires the grab release', () => {
    globals['game'] = { user: { id: 'gm1', isGM: true } };
    const endDrag = vi.fn();
    const wiring = {
      ...parts(),
      pointer: () => ({ isDragging: () => true, endDrag }) as unknown as VirtualPointer,
    };

    find('grab', wiring)?.activate();

    expect(endDrag).toHaveBeenCalledOnce();
  });
});

describe('the party access button', () => {
  /** ⚠️ Wired to the flow, not merely present. A list only appears if the wiring resolved. */
  it('puts the access list on screen for a GM', () => {
    partyWorld([GAMEMASTER]);

    find('party-access')?.activate();

    expect(document.body.textContent).toContain('Who may add characters?');
    expect(document.body.textContent).toContain('The Firebrands: closed to players');
  });

  /**
   * ⚠️ Reaches Foundry's own `fromUuid` and `setFlag`. The wiring between the flow and the document
   * is the part no focused suite can see: the flow is handed a `setAccess` port in its own tests, so
   * only here does the real lookup get exercised.
   */
  it('writes the flag through Foundry when a party is tapped', async () => {
    const setFlag = vi.fn(async () => Promise.resolve());
    partyWorld([GAMEMASTER]);
    globals['fromUuid'] = vi.fn(async () => Promise.resolve({ setFlag }));

    find('party-access')?.activate();
    [...document.querySelectorAll<HTMLButtonElement>('button[data-choice]')][0]?.click();

    await vi.waitFor(() => {
      expect(setFlag).toHaveBeenCalled();
    });
    expect(setFlag).toHaveBeenCalledWith('tongs-browser', 'allowPlayerCreation', true);
  });

  /** ⚠️ A missing `fromUuid` is reported, not swallowed: the GM must know nothing changed. */
  it('reports when this client cannot look a party up', async () => {
    const info = vi.fn();
    partyWorld([GAMEMASTER]);
    globals['ui'] = { notifications: { info } };

    find('party-access')?.activate();
    [...document.querySelectorAll<HTMLButtonElement>('button[data-choice]')][0]?.click();

    await vi.waitFor(() => {
      expect(info).toHaveBeenCalled();
    });
    expect(String(info.mock.calls[0]?.[0])).toContain('fromUuid');
  });
});
