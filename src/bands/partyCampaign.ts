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
  | { readonly kind: 'none'; readonly characters: readonly string[] }
  | { readonly kind: 'mixed'; readonly codes: readonly string[] };

/** A player character in the combat, and the campaigns of every party that lists it. */
export interface CombatCharacter {
  readonly name: string;
  readonly campaigns: readonly string[];
}

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

/** A character in no coded party does not count either way; with no code at all, every one is named. */
export function campaignForCombat(characters: readonly CombatCharacter[]): CampaignChoice {
  const codes = [
    ...new Set(characters.flatMap((c) => c.campaigns).filter((code) => code !== '')),
  ].sort();
  const [only] = codes;
  if (only === undefined) {
    return { kind: 'none', characters: characters.map((c) => c.name) };
  }
  return codes.length === 1 ? { kind: 'one', code: only } : { kind: 'mixed', codes };
}

/**
 * What the GM is told when a band could not be posted, or null when it could. ⛔ Found live 2026-09-15:
 * "no party in this combat has a campaign" with ten parties coded told the GM nothing they could act on,
 * so the characters that could not be placed are named.
 */
export function campaignProblem(choice: CampaignChoice): string | null {
  if (choice.kind === 'one') {
    return null;
  }
  if (choice.kind === 'mixed') {
    return `Tongs Browser posted no health band: this combat has characters from ${choice.codes.join(' and ')}, so it cannot tell which campaign it belongs to.`;
  }
  return choice.characters.length === 0
    ? 'Tongs Browser posted no health band: this combat has no player-owned character to take a campaign from.'
    : `Tongs Browser posted no health band: no party with a Path Wars campaign lists ${choice.characters.join(', ')}. Add them to one, or set its campaign under Module Settings, Party campaigns.`;
}
