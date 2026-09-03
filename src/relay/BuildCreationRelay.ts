import { MODULE_ID } from '../constants.js';
import { createSheetWithFoundry } from '../foundry/CreateSheetDeps.js';
import { readGmPresence } from '../foundry/DesignatedGm.js';
import type { GmGame } from '../foundry/DesignatedGm.js';
import { readParties, readUsers } from '../foundry/PartyAccess.js';
import type { FoundryGame } from '../foundry/PartyAccess.js';
import { CreationRelay } from './CreationRelay.js';
import type { SocketLike } from './PauseRelay.js';

/**
 * The real Foundry behind the creation relay. Added 2026-09-03.
 *
 * ⚠️ Its own file rather than more lines in `ModuleParts`, which was already at 196 of its 200. That
 * is the mechanical reason; the better one is that everything here is untestable without a world, and
 * keeping it apart means `CreationRelay` itself stays a thing a test can drive entirely through fakes.
 *
 * ⚠️ Every global is read LAZILY, on each call, exactly as `PauseRelay` does. The socket, the user
 * list and who counts as the designated GM all change during a session, and a GM disconnecting
 * mid-game is precisely the moment this has to pick the right client rather than the one that was
 * right at startup.
 */

/**
 * How long a player waits for a GM before being told nobody answered.
 *
 * ⚠️ Fifteen seconds, which is long. It has to cover a GM's client doing real work: resolving a
 * party, creating an actor and calling `addMembers`, on a machine that may be mid-scene-load. Too
 * short is the worse mistake, because it tells a player nothing happened while the sheet is in fact
 * being made, and the natural response to that is to tap again.
 */
const CREATION_TIMEOUT_MS = 15000;

interface RelayGlobals {
  readonly game?: { readonly socket?: SocketLike };
  readonly crypto?: { readonly randomUUID?: () => string };
}

export function buildCreationRelay(): CreationRelay {
  const globals = (): RelayGlobals => globalThis;
  const access = { getGame: (): FoundryGame | undefined => gameOf() };

  return new CreationRelay({
    get socket(): SocketLike | null {
      return globals().game?.socket ?? null;
    },
    channel: `module.${MODULE_ID}`,
    readPresence: () => readGmPresence({ getGame: (): GmGame | undefined => gameOf() }),
    myUserId: () => gameOf()?.user?.id ?? '',
    /*
     * ⚠️ Read through `PartyAccess`, which is the module's one permission-filtered boundary, even
     * though this runs on a GM's client where nothing would be filtered out anyway. Going around it
     * would mean a second place that enumerates documents, and the guard exists precisely so there
     * is never a second place.
     */
    readWorld: () => ({ parties: readParties(access), users: readUsers(access) }),
    create: async (ownerId, partyUuid, name) => {
      const outcome = await createSheetWithFoundry({ name, ownerId, partyUuid });
      if (outcome.kind === 'notCreated') {
        return { ok: false, reason: outcome.reason };
      }
      /*
       * ⚠️ `createdOutsideParty` counts as OK. The sheet exists and the player owns it; it simply is
       * not in the party. Reporting failure would tell them to try again and leave them with two.
       */
      return outcome.sheet.uuid === undefined
        ? { ok: true }
        : { ok: true, actorUuid: outcome.sheet.uuid };
    },
    /*
     * ⚠️ A fallback is REQUIRED, not defensive. `crypto.randomUUID` exists only in a secure context,
     * and Foundry over plain http on a LAN is exactly how this module is usually reached from a
     * phone. Throwing there would break the relay for its main audience.
     *
     * ⚠️ The fallback is scoped by USER ID, not a bare counter. Two clients both lacking
     * `randomUUID` would both start counting at one, collide, and a player would settle on somebody
     * else's answer, which is the precise bug `PendingRequests` exists to prevent. A user id is
     * already unique per client, so pairing it with a local counter makes a collision impossible
     * rather than unlikely.
     */
    newRequestId: () =>
      globals().crypto?.randomUUID?.() ??
      `${MODULE_ID}-${gameOf()?.user?.id ?? 'anon'}-${String(nextId())}`,
    timers: {
      setTimer: (run, ms) => globalThis.setTimeout(run, ms),
      clearTimer: (handle) => {
        globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>);
      },
      timeoutMs: CREATION_TIMEOUT_MS,
    },
  });
}

function gameOf(): (FoundryGame & GmGame) | undefined {
  return (globalThis as { game?: FoundryGame & GmGame }).game;
}

/** Local to this client, and only ever unique WITH the user id pairing it. See `newRequestId`. */
let counter = 0;
function nextId(): number {
  counter += 1;
  return counter;
}
