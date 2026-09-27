import type { CooResponse } from '../bands/CooClient.js';

/**
 * Adding a player to THIS running world without a restart. Added 2026-09-26.
 *
 * Lewis: "Using tongs like option 2 (live) that sounds amazing if we can get it working safely and securely!"
 * Foundry's server cannot create users in a running world; a connected GM can. So COO's heartbeat reply lists
 * players to create (`createUsers`), each with the Foundry id COO derives and a ONE-TIME password for this world
 * only. This browser creates them with that exact id (`keepId`) and tells COO which it made.
 *
 * ⛔ THE PASSWORD IS NEVER LOGGED OR KEPT. It goes straight into `User.create`, which Foundry hashes on its
 *    server, and then this code forgets it. COO replaces it with the player's normal password at the world's
 *    next launch. COO only ever hands these to a GM of this world whose Tongs asked (`liveUsers: true`).
 * ⚠️ A player who already exists here (made earlier, or twice-queued) gets the new password set rather than a
 *    second user: their id is the same, so creating again would fail.
 */
export interface LiveUser {
  readonly id: string;
  readonly name: string;
  readonly role: number;
  readonly password: string;
}

const ID = /^[A-Za-z0-9]{16}$/;

/** The players in COO's reply, ignoring anything shaped unexpectedly rather than throwing at a GM. */
export function liveUsersOf(body: unknown): LiveUser[] {
  const rows = (body as { createUsers?: unknown } | null)?.createUsers;
  if (!Array.isArray(rows)) {
    return [];
  }
  const users: LiveUser[] = [];
  for (const row of rows) {
    const { id, name, role, password } = (row ?? {}) as Record<string, unknown>;
    if (
      typeof id === 'string' &&
      ID.test(id) &&
      typeof name === 'string' &&
      name.length > 0 &&
      name.length <= 64 &&
      typeof role === 'number' &&
      Number.isInteger(role) &&
      role >= 1 &&
      role <= 4 &&
      typeof password === 'string' &&
      password.length >= 16 &&
      password.length <= 128
    ) {
      users.push({ id, name, role, password });
    }
  }
  return users;
}

type Call = (
  method: 'GET' | 'POST',
  path: string,
  body?: object
) => Promise<CooResponse | 'signed-out'>;

/** Creates each player, then confirms the ones that worked. Returns how many were confirmed. */
export async function addLiveUsers(
  worldId: string,
  users: readonly LiveUser[],
  create: (user: LiveUser) => Promise<boolean>,
  call: Call
): Promise<number> {
  const made: string[] = [];
  for (const user of users) {
    if (await create(user).catch(() => false)) {
      made.push(user.id);
    }
  }
  if (made.length === 0) {
    return 0;
  }
  const response = await call('POST', '/api/foundry/live-users/created', { worldId, ids: made });
  return response !== 'signed-out' && response.status === 200 ? made.length : 0;
}

/** The slice of Foundry's globals creating a user needs. */
export interface UserGlobals {
  readonly game?: {
    readonly users?: { get?(id: string): { update?(data: object): Promise<unknown> } | undefined };
  };
  readonly CONFIG?: {
    readonly User?: {
      readonly documentClass?: { create?(data: object, options: object): Promise<unknown> };
    };
  };
}

/** Creates the user with COO's id in this world, or sets the password on one that already exists. */
export function foundryCreateUser(globals: UserGlobals): (user: LiveUser) => Promise<boolean> {
  return async (user) => {
    const existing = globals.game?.users?.get?.(user.id);
    if (existing?.update) {
      await existing.update({ password: user.password });
      return true;
    }
    const documentClass = globals.CONFIG?.User?.documentClass;
    if (!documentClass?.create) {
      return false;
    }
    const made = await documentClass.create(
      { _id: user.id, name: user.name, role: user.role, password: user.password },
      { keepId: true }
    );
    return made !== undefined && made !== null;
  };
}
