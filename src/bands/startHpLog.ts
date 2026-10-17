import { readPartyCampaigns } from '../foundry/PartyAccess.js';
import type { FoundryGame } from '../foundry/PartyAccess.js';
import type { SharedBandPorts } from './bandPorts.js';
import type { CooClient } from './CooClient.js';
import type { HpChangePost } from './hpChange.js';
import { HpLogReporter } from './HpLogReporter.js';
import type { HpLogOutcome } from './HpLogReporter.js';
import { campaignForCombat, normalizeCampaign } from './partyCampaign.js';
import type { CampaignChoice } from './partyCampaign.js';
import type { StartGlobals } from './startBands.js';

/**
 * Connecting the HP log to Foundry and ComeOnOverUno. Added 2026-10-17.
 *
 * ⛔ NO SETTING, unlike the player-hit post: Lewis asked for every change to be recorded, and a record that a
 * checkbox can silence is not one. It still needs the GM's ComeOnOverUno sign-in and a party with a campaign.
 *
 * ⚠️ A 404, or an answer that is not COO's JSON, means the server is older than `hp-change`: the GM is told
 * once, and nothing else is affected.
 */
interface ActorRef {
  readonly uuid?: unknown;
  readonly name?: unknown;
  readonly isToken?: unknown;
  readonly token?: { readonly baseActor?: { readonly uuid?: unknown } | null } | null;
}

/** The world actor a party would list: an unlinked token's synthetic actor stands for its base actor. */
function worldUuid(actor: unknown): string | null {
  const ref = actor as ActorRef | null;
  const uuid = ref?.isToken === true ? ref.token?.baseActor?.uuid : ref?.uuid;
  return typeof uuid === 'string' ? uuid : null;
}

export function campaignOfCharacter(actor: unknown, game: FoundryGame | undefined): CampaignChoice {
  const uuid = worldUuid(actor);
  const name = (actor as ActorRef | null)?.name;
  const parties = readPartyCampaigns({ getGame: () => game });
  return campaignForCombat([
    {
      name: typeof name === 'string' ? name : 'an unnamed character',
      campaigns: parties
        .filter((party) => uuid !== null && party.members.includes(uuid))
        .map((party) => normalizeCampaign(party.campaign)),
    },
  ]);
}

export async function postHpChange(
  client: Pick<CooClient, 'call'>,
  campaign: string,
  change: HpChangePost
): Promise<HpLogOutcome> {
  const response = await client.call(
    'POST',
    `/api/pathwars/campaigns/${encodeURIComponent(campaign)}/hp-change`,
    change
  );
  if (response === 'signed-out') {
    return response;
  }
  if (response.status === 404) {
    return 'not-deployed';
  }
  if (response.status !== 200) {
    return 'failed';
  }
  /* An older server answers an unknown POST with its web app's page, a 200 that is not a record. */
  const body = (await response.json().catch(() => null)) as { recorded?: unknown } | null;
  return body?.recorded === true ? 'sent' : 'not-deployed';
}

export function buildHpLog(
  globals: StartGlobals,
  client: Pick<CooClient, 'call'>,
  shared: SharedBandPorts
): HpLogReporter {
  const game = () => globals.game as FoundryGame | undefined;
  const reporter = new HpLogReporter({
    role: shared.role,
    causeFor: shared.causeFor,
    warn: shared.warn,
    actors: () => game()?.actors ?? [],
    campaignOf: (actor) => campaignOfCharacter(actor, game()),
    post: async (campaign, change) => postHpChange(client, campaign, change),
    now: () => Date.now(),
  });
  reporter.seed();
  return reporter;
}
