/**
 * A Foundry on `globalThis`, as `BuildCreationRelay` reads it. Extracted 2026-09-03 when the suite
 * crossed the 200 line limit and split into "what it builds" and "what a request carries".
 *
 * ⚠️ `users` is an ARRAY with `activeGM` hung off it, which looks odd and is deliberate: Foundry's
 * `Users` collection is both iterable and the thing that answers `activeGM`. A fixture that made them
 * two separate objects would let a wiring bug through, because the code reaches for both on one value.
 */
export const globals = globalThis as unknown as Record<string, unknown>;

export interface Emitted {
  readonly requestId?: string;
  readonly userId?: string;
}

/** A world with one party, open to players, and a socket that records what was sent. */
export function world(over: Record<string, unknown> = {}): { sent: Emitted[] } {
  const sent: Emitted[] = [];
  globals['game'] = {
    user: { id: 'gm1', isGM: true },
    users: Object.assign([{ id: 'gm1', name: 'The GM', isGM: true }], {
      activeGM: { id: 'gm1', name: 'The GM' },
    }),
    actors: [
      {
        uuid: 'Actor.p',
        name: 'The Firebrands',
        type: 'party',
        testUserPermission: () => true,
        getFlag: () => true,
      },
    ],
    socket: {
      on: () => undefined,
      off: () => undefined,
      emit: (_event: string, payload: Emitted) => sent.push(payload),
    },
    ...over,
  };
  return { sent };
}

/** The document globals `CreateSheetDeps` reaches for, in their working state. */
export function stubFoundryDocuments(): void {
  globals['Actor'] = {
    create: async () => Promise.resolve({ uuid: 'Actor.new', name: 'Bramble' }),
  };
  globals['fromUuid'] = async () => Promise.resolve({ addMembers: async () => Promise.resolve() });
}

export function clearFoundry(): void {
  for (const key of ['game', 'Actor', 'fromUuid']) {
    Reflect.deleteProperty(globals, key);
  }
}
