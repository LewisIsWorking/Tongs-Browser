import { MODULE_ID } from '../constants.js';
import { logger } from '../core/Logger.js';
import { escapeHtml } from '../bands/settingsMenu.js';
import { joinPartyWithFoundry, setFlagWithFoundry } from '../foundry/CreateSheetDeps.js';
import { readGmPresence } from '../foundry/DesignatedGm.js';
import type { GmGame } from '../foundry/DesignatedGm.js';
import { readPartyCampaigns } from '../foundry/PartyAccess.js';
import type { FoundryGame } from '../foundry/PartyAccess.js';
import { OWNER_LEVEL } from '../foundry/SheetCreationTypes.js';
import {
  COMPANIONS_MADE_FLAG,
  COMPANION_KIND_FLAG,
  COMPANION_OF_FLAG,
  companionPackId,
} from './companionKinds.js';
import { companionListing } from './companionDocuments.js';
import type { CompanionGame } from './companionDocuments.js';
import { Companions } from './Companions.js';
import type { NewCompanion } from './Companions.js';
import { WELCOME_SETTING } from './startSheetRequests.js';
import type { WelcomeHooks, WelcomeSettings } from './startSheetRequests.js';

/**
 * The GM's browser making companion sheets, wired to Foundry. Added 2026-10-12; the rules are in
 * Companions.ts, what grants a companion in companionKinds.ts.
 *
 * ⚠️ Behind the same switch as the new-player welcome (`newPlayerWelcome`), and woken by the same hooks
 *    plus `createItem`, because a familiar usually arrives as a feat added to a sheet that already exists.
 * ⚠️ Tongs assumes PF2e Companion Compendia (`pf2e-animal-companions`) is active (Lewis, 2026-10-12). A pack
 *    it names that is missing is reported to the GM and the player, never thrown.
 */
interface CompanionGlobals {
  readonly game?: CompanionGame &
    GmGame & {
      readonly system?: { readonly id?: string };
      readonly packs?: {
        get(
          id: string
        ): { readonly title?: string; readonly metadata?: { readonly label?: string } } | undefined;
      };
    };
  readonly ui?: { readonly notifications?: { info?(message: string): unknown } };
  readonly Actor?: { create?(data: object): Promise<{ readonly uuid?: string } | null> };
  readonly ChatMessage?: { create?(data: object): Promise<unknown> };
}

export function startCompanions(
  hooks: WelcomeHooks,
  settings: WelcomeSettings,
  globals: CompanionGlobals
): Companions {
  const game = () => globals.game;
  const companions = new Companions({
    isDesignatedGm: () => readGmPresence({ getGame: game }).isMe,
    listing: () => companionListing(game()),
    partyOf: (uuid) => {
      const party = readPartyCampaigns({ getGame: () => game() as FoundryGame | undefined }).find(
        (each) => each.members.includes(uuid)
      );
      return party === undefined ? null : { uuid: party.uuid, name: party.name };
    },
    packLabel: (pack) => {
      const found = game()?.packs?.get(companionPackId(pack, game()?.system?.id));
      return found === undefined ? null : (found.metadata?.label ?? found.title ?? pack);
    },
    create: async (companion) => createCompanion(globals, companion),
    join: joinPartyWithFoundry,
    markMade: async (uuid, kinds) =>
      setFlagWithFoundry(uuid, MODULE_ID, COMPANIONS_MADE_FLAG, kinds),
    tellPlayers: async (userIds, text) => {
      await globals.ChatMessage?.create?.({
        content: `<p>${escapeHtml(text)}</p>`,
        whisper: [...userIds],
        speaker: { alias: 'Tongs' },
      });
    },
    tellGm: (text) => globals.ui?.notifications?.info?.(text),
  });

  const run = (): void => {
    if (settings.get(MODULE_ID, WELCOME_SETTING) !== true || game()?.user?.isGM !== true) {
      return;
    }
    companions.serve().catch((error: unknown) => {
      logger.warn(
        `Companion sheets failed: ${error instanceof Error ? error.message : String(error)}`
      );
    });
  };
  for (const name of [
    'userConnected',
    'createActor',
    'updateActor',
    'createItem',
    'updateSetting',
  ]) {
    hooks.on(name, run);
  }
  run();
  return companions;
}

/**
 * ⚠️ Owned AT CREATION by the character's owners, like a new player's sheet (SheetCreation.ts). A familiar
 *    is PF2e's `familiar` actor with its master set; everything else is a `character` (companionKinds.ts).
 * ⚠️ Made in the character's own Actors folder, so it sits next to it in the sidebar; at the root when the
 *    character has none. Before 2026-10-22 every companion was made at the root.
 */
async function createCompanion(
  globals: CompanionGlobals,
  companion: NewCompanion
): Promise<string> {
  const actor = globals.Actor;
  if (actor?.create === undefined) {
    throw new Error('Foundry has no Actor.create on this client.');
  }
  const { character, kind } = companion;
  const made = await actor.create({
    name: companion.name,
    type: kind.actorType,
    ownership: Object.fromEntries(character.ownerIds.map((id) => [id, OWNER_LEVEL])),
    folder: character.folderId,
    ...(kind.actorType === 'familiar' ? { system: { master: { id: character.id } } } : {}),
    flags: {
      [MODULE_ID]: { [COMPANION_OF_FLAG]: character.uuid, [COMPANION_KIND_FLAG]: kind.kind },
    },
  });
  if (typeof made?.uuid !== 'string') {
    throw new Error('Foundry returned no actor.');
  }
  return made.uuid;
}
