import { MODULE_ID } from '../constants.js';
import { PARTY_CAMPAIGN_FLAG } from '../foundry/PartyAccess.js';
import type { PartyCampaignEntry } from '../foundry/PartyAccess.js';
import { normalizeCampaign } from './partyCampaign.js';
import { escapeHtml, registerGmMenu } from './settingsMenu.js';
import type { MenuGlobals, MenuSettings } from './settingsMenu.js';

/**
 * Setting each party's Path Wars campaign, from the module settings. Added 2026-09-15.
 *
 * Decided with Lewis: the campaign is set PER PARTY, stored on the party itself, so renaming a party
 * never changes where its bands go. One field per party, in Foundry's own `DialogV2.input`.
 *
 * ⚠️ Only a changed value is written, and a value that is not a campaign code is refused with a
 * warning rather than saved, so a typo never quietly stops a party's bands.
 */
const PARTY_CAMPAIGNS_MENU = 'partyCampaigns';

interface WritableParty {
  setFlag?(scope: string, key: string, value: unknown): Promise<unknown>;
}

export interface PartyCampaignGlobals extends MenuGlobals {
  readonly foundry?: MenuGlobals['foundry'] & {
    readonly applications?: {
      readonly api?: { readonly DialogV2?: { input?(options: object): Promise<unknown> } };
    };
  };
  readonly ui?: {
    readonly notifications?: { info?(message: string): unknown; warn?(message: string): unknown };
  };
  readonly fromUuidSync?: (uuid: string) => unknown;
}

const field = (index: number) => `party${String(index)}`;

/** Opens the dialog and saves what changed. Resolves to how many parties were saved. */
export async function editPartyCampaigns(
  globals: PartyCampaignGlobals,
  readParties: () => readonly PartyCampaignEntry[]
): Promise<number> {
  const notify = globals.ui?.notifications;
  const parties = readParties();
  if (parties.length === 0) {
    notify?.warn?.('There are no parties in this world to give a campaign to.');
    return 0;
  }
  const content = parties
    .map(
      (party, index) =>
        `<label>${escapeHtml(party.name)} <input name="${field(index)}" type="text" placeholder="C06" value="${escapeHtml(normalizeCampaign(party.campaign))}"></label>`
    )
    .join('');
  const answer = (await globals.foundry?.applications?.api?.DialogV2?.input?.({
    window: { title: 'Path Wars campaign for each party' },
    content,
    ok: { label: 'Save' },
  })) as Record<string, unknown> | null | undefined;
  if (answer === null || answer === undefined) {
    return 0;
  }

  let saved = 0;
  for (const [index, party] of parties.entries()) {
    const raw = answer[field(index)];
    if (raw === undefined) {
      continue;
    }
    const typed = typeof raw === 'string' ? raw.trim() : '';
    const code = normalizeCampaign(typed);
    if (typed !== '' && code === '') {
      notify?.warn?.(`"${typed}" is not a campaign code, so ${party.name} was not changed.`);
      continue;
    }
    if (code === normalizeCampaign(party.campaign)) {
      continue;
    }
    const actor = globals.fromUuidSync?.(party.uuid) as WritableParty | null | undefined;
    await actor?.setFlag?.(MODULE_ID, PARTY_CAMPAIGN_FLAG, code);
    saved += 1;
  }
  notify?.info?.(`Saved the campaign for ${String(saved)} ${saved === 1 ? 'party' : 'parties'}.`);
  return saved;
}

export function registerPartyCampaignsMenu(
  settings: MenuSettings,
  globals: PartyCampaignGlobals,
  readParties: () => readonly PartyCampaignEntry[]
): boolean {
  return registerGmMenu(
    settings,
    globals,
    {
      key: PARTY_CAMPAIGNS_MENU,
      name: 'Party campaigns',
      label: 'Set campaigns',
      hint: "Which Path Wars campaign each party plays in. A combat's health bands go to the campaign of the player characters fighting in it.",
      icon: 'fas fa-flag',
    },
    async () => editPartyCampaigns(globals, readParties)
  );
}
