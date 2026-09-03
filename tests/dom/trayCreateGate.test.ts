import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  clearWorld,
  findTrayAction,
  globals,
  partyWorld,
  playerWorld,
  GAMEMASTER,
} from './support/trayWiringWorld.js';

/**
 * Who is offered the create button. Written 2026-09-03, split from `trayWiring.test.ts` when it
 * crossed the size limit, and rewritten when the relay opened the button to players.
 *
 * ⚠️ The button exists exactly when it can DO something. For a player that means a GM has opened a
 * party to them; before that, tapping it could only ever end in a refusal, and a control that is
 * present and cannot work is worse than one that is absent because it invites the tap.
 *
 * ⚠️ It is deliberately NOT gated on a GM being ONLINE, and that is asserted below. A button that came
 * and went as GMs connected would be a mystery to the person watching it; being told "a GM has to be
 * online" is a fact they can act on. Presence decides the MESSAGE, never whether the control exists.
 *
 * COVERS: GM, player with an open party, player without one, and an unknown viewer.
 * MISSES: what happens when it is tapped, which lives in `trayWiring.test.ts`.
 */
const find = (id: string): unknown => findTrayAction(id);

beforeEach(() => {
  clearWorld();
});
afterEach(() => {
  clearWorld();
});

describe('a GM', () => {
  it('is offered it with no parties at all, because they can make one anywhere', () => {
    globals['game'] = { user: { id: 'gm1', isGM: true } };

    expect(find('create-sheet')).toBeDefined();
  });

  it('is offered it in a world that has a closed party', () => {
    partyWorld([GAMEMASTER]);

    expect(find('create-sheet')).toBeDefined();
  });
});

describe('a player', () => {
  /** ⚠️ THE change the relay bought. Before it, this button was hidden from players entirely. */
  it('is offered it once a GM has opened a party to them', () => {
    playerWorld(true);

    expect(find('create-sheet')).toBeDefined();
  });

  /**
   * ⚠️ ABSENT while every party is closed. Tapping could only end in a refusal, and the honest way to
   * say "your GM has not opened anything" is not to offer the control at all.
   */
  it('is not offered it while every party is closed to them', () => {
    playerWorld(false);

    expect(find('create-sheet')).toBeUndefined();
  });

  it('is not offered it in a world with no parties', () => {
    globals['game'] = { user: { id: 'p1', isGM: false } };

    expect(find('create-sheet')).toBeUndefined();
  });

  /**
   * ⚠️ Offered even with NO GM ONLINE. The alternative was tempting and is worse: a button that
   * appears and disappears as GMs come and go gives a player nothing to reason about, whereas a
   * refusal naming the reason tells them exactly what to wait for.
   */
  it('is still offered it when no GM is connected', () => {
    playerWorld(true);
    (globals['game'] as { users?: unknown }).users = { activeGM: null };

    expect(find('create-sheet')).toBeDefined();
  });
});

describe('a viewer Foundry cannot identify', () => {
  /** ⚠️ Counts as a player, which is the safer of the two mistakes. */
  it('is not offered it', () => {
    expect(find('create-sheet')).toBeUndefined();
  });
});
