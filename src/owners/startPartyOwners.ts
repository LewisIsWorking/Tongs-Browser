import { logger } from '../core/Logger.js';
import { readGmPresence } from '../foundry/DesignatedGm.js';
import type { GmGame } from '../foundry/DesignatedGm.js';
import { PartyOwners, registerPartyOwners, storedPartyOwners } from './partyOwners.js';
import type { OwnerSettings, PrimaryParty } from './partyOwners.js';

/**
 * Making ComeOnOverUno's listed users owners of the world's primary party, wired to Foundry. Added
 * 2026-10-12; the rules are in partyOwners.ts.
 *
 * ⚠️ In `check:documents`' BOUNDARY, and it does NOT enumerate: it reads PF2e's one active party
 *    (`game.actors.party`) and looks users up one at a time by an id COO sent (`game.users.get`), only in
 *    the designated GM's browser. It lists nothing and shows nothing but a name the GM can already see.
 */
interface OwnerGlobals {
  readonly game?: GmGame & {
    readonly actors?: {
      readonly party?: (Omit<PrimaryParty, 'name'> & { readonly name?: string | null }) | null;
    };
    readonly users?: { get?(id: string): { readonly name?: string | null } | undefined };
  };
  readonly ui?: { readonly notifications?: { info?(message: string): unknown } };
}

interface OwnerHooks {
  on(name: string, fn: (...args: never[]) => unknown): unknown;
}

export function startPartyOwners(
  hooks: OwnerHooks,
  settings: OwnerSettings,
  globals: OwnerGlobals
): PartyOwners {
  registerPartyOwners(settings);
  const game = () => globals.game;
  const owners = new PartyOwners({
    isDesignatedGm: () => readGmPresence({ getGame: game }).isMe,
    wanted: () => storedPartyOwners(settings),
    party: () => {
      const party = game()?.actors?.party;
      return party === null || party === undefined
        ? null
        : {
            name: party.name ?? 'the party',
            ownership: party.ownership,
            update: async (data) => party.update(data),
          };
    },
    userName: (id) => {
      const user = game()?.users?.get?.(id);
      return user === undefined ? null : (user.name ?? 'A player');
    },
    tellGm: (text) => globals.ui?.notifications?.info?.(text),
  });
  const run = (): void => {
    if (game()?.user?.isGM !== true) {
      return;
    }
    owners.serve().catch((error: unknown) => {
      logger.warn(`Party owners failed: ${error instanceof Error ? error.message : String(error)}`);
    });
  };
  for (const name of [
    'updateSetting',
    'userConnected',
    'createUser',
    'createActor',
    'updateActor',
  ]) {
    hooks.on(name, run);
  }
  run();
  return owners;
}
