import { MODULE_ID } from '../constants.js';
import type { SharedBandPorts } from './bandPorts.js';
import { combatViews, viewsForActor } from './bandTokens.js';
import type { CooClient } from './CooClient.js';
import { PlayerHitReporter } from './PlayerHitReporter.js';
import type { BandSettings, StartGlobals } from './startBands.js';

/**
 * The player-hit post's setting, and connecting its reporter to Foundry. Added 2026-09-28.
 *
 * ⚠️ ON BY DEFAULT, unlike the automation: it posts, it never changes a character, and Lewis asked for it
 * ("Post in the combat topic"). Like bands, nothing is posted until a party has a campaign, and the post
 * needs the GM's ComeOnOverUno sign-in.
 */
export const PLAYER_HITS_SETTING = 'postPlayerHits';

export function registerPlayerHitSetting(settings: Pick<BandSettings, 'register'>): void {
  settings.register(MODULE_ID, PLAYER_HITS_SETTING, {
    name: 'Post hits on player characters to the combat topic',
    hint:
      "When a player character takes damage in a fight, the campaign's combat topic hears how much, from " +
      "what when players can see the attacker, and the HP left, with the character's picture.",
    scope: 'world',
    config: true,
    type: Boolean,
    default: true,
  });
}

/** ⚠️ Foundry's hooks are `startBands`'s: one handler per event drives both reporters, in order. */
export function buildPlayerHits(
  settings: Pick<BandSettings, 'get'>,
  globals: StartGlobals,
  client: CooClient,
  shared: SharedBandPorts
): PlayerHitReporter {
  const reporter = new PlayerHitReporter({
    ...shared,
    enabled: () => settings.get(MODULE_ID, PLAYER_HITS_SETTING) !== false,
    viewsFor: (actor) => viewsForActor(actor, globals),
    combatViews: () => combatViews(globals),
    post: async (campaign, hit) => {
      const response = await client.call(
        'POST',
        `/api/pathwars/campaigns/${encodeURIComponent(campaign)}/player-hit`,
        hit
      );
      return response === 'signed-out' ? response : response.status === 200 ? 'sent' : 'failed';
    },
  });
  reporter.seed();
  return reporter;
}
