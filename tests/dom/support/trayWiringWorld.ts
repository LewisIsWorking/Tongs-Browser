import { wireTrayActions } from '../../../src/TrayWiring.js';
import type { TrayWiring } from '../../../src/TrayWiring.js';
import type { CanvasController } from '../../../src/gesture/CanvasController.js';
import type { DragDiagnostics } from '../../../src/debug/DragDiagnostics.js';
import type { FoundryActions } from '../../../src/foundry/FoundryActions.js';
import type { TrayAction } from '../../../src/modifiers/TrayAction.js';
import type { VirtualPointer } from '../../../src/pointer/VirtualPointer.js';

/**
 * A tray wired against a stubbed Foundry. Extracted 2026-09-02 when the wiring suite crossed the 200
 * line limit and the reporting tests moved into their own file.
 */
export const globals = globalThis as unknown as Record<string, unknown>;

/**
 * ⚠️ A relay that refuses everything, because these tests are about the WIRING, not the round trip.
 * A relay that succeeded would make a player's create indistinguishable from a GM's, and the point of
 * several of these tests is that the two take different routes. `creationRelay.test.ts` owns the
 * round trip.
 */
const refusingRelay = (): TrayWiring['creationRelay'] =>
  ({
    request: async () => Promise.resolve({ kind: 'noGm' as const }),
    bind: () => undefined,
    unbind: () => undefined,
    isBound: () => false,
  }) as unknown as TrayWiring['creationRelay'];

export const parts = (over: Partial<TrayWiring> = {}): TrayWiring => ({
  actions: {} as FoundryActions,
  pointer: () => ({}) as VirtualPointer,
  diagnostics: {} as DragDiagnostics,
  document,
  creationRelay: refusingRelay(),
  ...over,
});

export const findTrayAction = (id: string, wiring = parts()): TrayAction | undefined =>
  wireTrayActions({} as CanvasController, wiring).find((action) => action.id === id);

/**
 * A world with one party and the given users, as a GM sees it.
 *
 * ⚠️ The user COUNT matters and is the caller's choice for a reason: with exactly one assignable user
 * the flow creates directly and shows no picker, because a choice of one is a tap for no decision.
 * A test expecting a picker needs two. The first draft of the wiring suite got this wrong and failed
 * on its own fixture.
 */
export function partyWorld(users: { id: string; name: string; isGM: boolean }[]): void {
  globals['game'] = {
    user: { id: 'gm1', isGM: true },
    actors: [
      {
        uuid: 'Actor.p',
        name: 'The Firebrands',
        type: 'party',
        testUserPermission: () => true,
        getFlag: () => undefined,
      },
    ],
    users,
  };
}

/**
 * A world seen by a PLAYER, with one party that is either open to them or not.
 *
 * ⚠️ The flag is what decides whether the create button exists for them, so it is the only thing
 * that varies here. Everything else is held identical on purpose: a test where two things differ
 * cannot say which one the button was responding to.
 */
export function playerWorld(openToPlayers: boolean): void {
  globals['game'] = {
    user: { id: 'p1', isGM: false },
    actors: [
      {
        uuid: 'Actor.p',
        name: 'The Firebrands',
        type: 'party',
        testUserPermission: () => true,
        getFlag: () => (openToPlayers ? true : undefined),
      },
    ],
    users: [{ id: 'p1', name: 'Ana', isGM: false }],
  };
}

export const GAMEMASTER = { id: 'gm1', name: 'Gamemaster', isGM: true };
export const ANA = { id: 'p1', name: 'Ana', isGM: false };

/** Everything this fixture puts on `globalThis`, removed. */
export function clearWorld(): void {
  for (const key of ['game', 'ui', 'Actor', 'fromUuid']) {
    Reflect.deleteProperty(globals, key);
  }
}
