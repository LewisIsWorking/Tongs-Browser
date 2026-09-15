/**
 * Which Path Wars campaign a combat belongs to. Added 2026-09-15.
 *
 * ⛔ DECIDED WITH LEWIS, 2026-09-15: several campaigns share one Foundry world (C04, C05, C06, C07 and
 * C09 do), so the campaign is set PER PARTY, and a combat belongs to the campaign of the player
 * characters fighting in it.
 *
 * ⛔ NEVER GUESS. A combat whose player characters carry no campaign, or carry two different ones, posts
 * nothing at all and the GM is told why. A band in the wrong campaign's topic tells another table about
 * a fight it is not in.
 */
export type CampaignChoice =
  | { readonly kind: 'one'; readonly code: string }
  | { readonly kind: 'none' }
  | { readonly kind: 'mixed'; readonly codes: readonly string[] };

/**
 * Campaign codes as the Nudge bot's config.json writes them: a C and digits, "C00" to "C10" on
 * 2026-09-15. A party NAME typed by mistake ("Kibwe") must not read as a code.
 */
const CODE = /^C\d{1,3}$/;

/** "c06 " reads as "C06"; anything else, including nothing, reads as no campaign. */
export function normalizeCampaign(value: unknown): string {
  const code = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return CODE.test(code) ? code : '';
}

/**
 * One entry per player character in the combat: the campaigns of every party it belongs to.
 * A character in no coded party does not count either way.
 */
export function campaignForCombat(characters: readonly (readonly string[])[]): CampaignChoice {
  const codes = [...new Set(characters.flat().filter((code) => code !== ''))].sort();
  const [only] = codes;
  if (only === undefined) {
    return { kind: 'none' };
  }
  return codes.length === 1 ? { kind: 'one', code: only } : { kind: 'mixed', codes };
}

/** What the GM is told when a band could not be posted, or null when it could. */
export function campaignProblem(choice: CampaignChoice): string | null {
  if (choice.kind === 'one') {
    return null;
  }
  return choice.kind === 'none'
    ? 'Tongs Browser posted no health band: no party in this combat has a Path Wars campaign. Set one under Module Settings, Party campaigns.'
    : `Tongs Browser posted no health band: this combat has characters from ${choice.codes.join(' and ')}, so it cannot tell which campaign it belongs to.`;
}
