import { automationRole } from '../automation/automationRole.js';
import type { RoleGlobals } from '../automation/automationRole.js';
import { nameRules } from '../bands/bandTokens.js';
import type { BandGlobals } from '../bands/bandTokens.js';
import { combatCampaign } from '../bands/combatCampaign.js';
import type { CampaignCombat } from '../bands/combatCampaign.js';
import type { CooClient } from '../bands/CooClient.js';
import { MODULE_ID } from '../constants.js';
import { logger } from '../core/Logger.js';
import { readPartyCampaigns, readUsers } from '../foundry/PartyAccess.js';
import type { FoundryGame } from '../foundry/PartyAccess.js';
import { EncounterSync } from './EncounterSync.js';
import { readEncounter } from './encounterSnapshot.js';
import type { CombatLike } from './encounterSnapshot.js';
import {
  readPlayerLinks,
  registerPlayerLinksMenu,
  registerPlayerLinksSetting,
} from './playerLinks.js';
import type { LinkGlobals, LinkSettings } from './playerLinks.js';

/**
 * Switching encounter sync on for a world, and connecting it to Foundry's hooks. Added 2026-09-16.
 *
 * ⛔ OFF UNTIL A GM TURNS IT ON, per world, like every automation Tongs has: a release must never start
 * posting to Telegram by surprise. The setting is read on each event, so turning it on needs no reload.
 *
 * ⚠️ WHICH CHANGES COUNT. A combat update counts only when it moves the round or the turn, or starts or stops the
 * encounter: saving the tracker id as a flag is also a combat update, and counting it would post again forever.
 * A combatant joining, leaving, being hidden, defeated or reordered by initiative changes the tracker too.
 */
const SYNC_ENCOUNTERS_SETTING = 'syncEncounters';
const TRACKER_FLAG = 'trackerMessageId';

const COMBAT_KEYS = ['round', 'turn', 'active', 'started'];
const COMBATANT_KEYS = ['hidden', 'defeated', 'initiative'];

interface FlaggedCombat extends CombatLike {
  getFlag?(scope: string, key: string): unknown;
  setFlag?(scope: string, key: string, value: unknown): Promise<unknown>;
}

interface HooksLike {
  on(name: string, fn: (...args: never[]) => unknown): number;
}

export type EncounterGlobals = BandGlobals &
  RoleGlobals & {
    readonly game?: { readonly combats?: { readonly contents?: readonly unknown[] } | null };
  };

function registerSyncEncountersSetting(settings: LinkSettings): void {
  settings.register(MODULE_ID, SYNC_ENCOUNTERS_SETTING, {
    name: 'Sync encounters to the combat topic',
    hint:
      "Keeps one tracker message per encounter in the campaign's Telegram combat topic: the round, the allies " +
      'still to act with their players named, then the enemies. The Path Wars bot pings from it. Needs the ' +
      'ComeOnOverUno sign-in, party campaigns and Telegram players set.',
    scope: 'world',
    config: true,
    type: Boolean,
    default: false,
  });
}

/** At init: the on/off setting, the saved links, and the GM's menu that sets them. */
export function registerEncounterSync(
  settings: LinkSettings,
  client: CooClient,
  globals: LinkGlobals & { readonly game?: unknown }
): void {
  registerSyncEncountersSetting(settings);
  registerPlayerLinksSetting(settings);
  registerPlayerLinksMenu(settings, globals, client, () =>
    readUsers({ getGame: () => globals.game as FoundryGame | undefined }).filter(
      (user) => !user.isGm
    )
  );
}

const touches = (changes: unknown, keys: readonly string[]) =>
  typeof changes === 'object' && changes !== null && keys.some((key) => key in changes);

export function startEncounterSync(
  hooks: HooksLike,
  settings: LinkSettings,
  globals: EncounterGlobals,
  client: CooClient
): EncounterSync {
  const sync = new EncounterSync({
    role: () => automationRole(globals),
    campaign: (combat) =>
      combatCampaign(
        combat as CampaignCombat,
        readPartyCampaigns({ getGame: () => globals.game as FoundryGame | undefined })
      ),
    read: (combat, ended) =>
      readEncounter(combat, readPlayerLinks(settings), nameRules(globals), ended),
    trackerId: (combat) => {
      const id = (combat as FlaggedCombat).getFlag?.(MODULE_ID, TRACKER_FLAG);
      return typeof id === 'number' ? id : undefined;
    },
    saveTrackerId: async (combat, id) => {
      await (combat as FlaggedCombat).setFlag?.(MODULE_ID, TRACKER_FLAG, id);
    },
    post: async (code, snapshot) => {
      const response = await client.call(
        'POST',
        `/api/pathwars/campaigns/${encodeURIComponent(code)}/encounter`,
        snapshot
      );
      if (response === 'signed-out') {
        return response;
      }
      const body =
        response.status === 200
          ? ((await response.json()) as { trackerMessageId?: unknown })
          : null;
      return typeof body?.trackerMessageId === 'number' ? body.trackerMessageId : null;
    },
    later: (run, ms) => setTimeout(run, ms),
    cancel: (handle) => {
      clearTimeout(handle as ReturnType<typeof setTimeout>);
    },
  });
  const on = () => settings.get(MODULE_ID, SYNC_ENCOUNTERS_SETTING) === true;
  const guard = (label: string, work: Promise<void> | undefined) => {
    work?.catch((error: unknown) => {
      logger.warn(
        `Encounter sync ${label} failed: ${error instanceof Error ? error.message : String(error)}`
      );
    });
  };

  hooks.on('updateCombat', (combat: CombatLike, changes: unknown) => {
    if (on() && touches(changes, COMBAT_KEYS)) guard('on a turn', sync.changed(combat));
  });
  for (const name of ['createCombatant', 'deleteCombatant', 'updateCombatant']) {
    hooks.on(name, (combatant: { parent?: CombatLike | null }, changes?: unknown) => {
      const counts = name !== 'updateCombatant' || touches(changes, COMBATANT_KEYS);
      if (on() && counts && combatant.parent)
        guard('on a combatant', sync.changed(combatant.parent));
    });
  }
  hooks.on('deleteCombat', (combat: CombatLike) => {
    if (on()) guard('on an ending', sync.changed(combat, true));
  });
  /* ⚠️ On load, every running encounter again: COO may have restarted and forgotten them. */
  if (on()) {
    for (const combat of (globals.game?.combats?.contents ?? []) as CombatLike[]) {
      guard('on load', sync.send(combat, false));
    }
  }
  return sync;
}
