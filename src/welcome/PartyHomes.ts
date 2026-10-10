import { pickParty } from './campaignParty.js';
import type { CampaignParty } from './campaignParty.js';
import type { HomeListing } from './welcomeDocuments.js';

/**
 * The GM's browser putting a player's sheet in the campaign's party when nobody did. Added 2026-10-10.
 *
 * Found live in C07: Livy was copied into the world rather than made by the welcome, so she was in no
 * party and the party sheet read "No Members". Lewis, asked whether Tongs should add such sheets: "Yes".
 *
 * ⚠️ Narrow on purpose, because old worlds hold dozens of retired sheets that belong in no party. A sheet
 *    is added only when ALL of these hold:
 *    - a party can be picked for its player (`pickParty`): the world's one campaign party, or, where C00 and
 *      C01 (or C06 and C11) share a world, the one of the campaign the player posts in (Lewis, 2026-10-10);
 *    - its player has no sheet in ANY party, so a player already at the table gains nothing;
 *    - that player owns exactly ONE sheet outside a party, so Tongs never picks between characters;
 *    - Tongs has never added it before (`JOINED_FLAG`), so a GM who takes it out is not overruled.
 *
 * ⚠️ One pass at a time, like SheetRequests: adding a member fires `updateActor`, which wakes this again.
 */
export interface PartyHomePorts {
  readonly isDesignatedGm: () => boolean;
  readonly campaignParties: () => readonly CampaignParty[];
  readonly campaignsOf?: (userId: string) => readonly string[];
  readonly listing: () => HomeListing;
  /** Every actor uuid that is a member of any party. */
  readonly members: () => ReadonlySet<string>;
  readonly join: (partyUuid: string, sheetUuid: string) => Promise<void>;
  readonly markJoined: (sheetUuid: string, partyUuid: string) => Promise<void>;
  readonly tellGm: (text: string) => void;
}

export interface Homeless {
  readonly playerId: string;
  readonly sheetUuid: string;
  readonly sheetName: string;
  readonly playerName: string;
}

/** The sheets to add, by the rules above. */
export function homeless(listing: HomeListing, members: ReadonlySet<string>): Homeless[] {
  const found = new Map<string, Homeless>();
  for (const player of listing.players) {
    const theirs = listing.characters.filter((sheet) => sheet.ownerIds.includes(player.id));
    const loose = theirs.filter((sheet) => !members.has(sheet.uuid));
    const only = loose.length === theirs.length && loose.length === 1 ? loose[0] : undefined;
    if (only !== undefined && !only.joined) {
      found.set(only.uuid, {
        playerId: player.id,
        sheetUuid: only.uuid,
        sheetName: only.name,
        playerName: player.name,
      });
    }
  }
  return [...found.values()];
}

export class PartyHomes {
  private running = false;
  private again = false;

  public constructor(private readonly ports: PartyHomePorts) {}

  public async serve(): Promise<void> {
    if (!this.ports.isDesignatedGm()) {
      return;
    }
    if (this.running) {
      this.again = true;
      return;
    }
    this.running = true;
    try {
      do {
        this.again = false;
        await this.pass();
      } while (this.askedAgain());
    } finally {
      this.running = false;
    }
  }

  /** A method, not a field read: the compiler cannot see the hooks that set it while a pass awaits. */
  private askedAgain(): boolean {
    return this.again;
  }

  private async pass(): Promise<void> {
    const parties = this.ports.campaignParties();
    for (const sheet of homeless(this.ports.listing(), this.ports.members())) {
      const pick = pickParty(null, parties, this.ports.campaignsOf?.(sheet.playerId));
      if (pick.kind !== 'party') {
        continue;
      }
      const { party } = pick;
      try {
        await this.ports.join(party.uuid, sheet.sheetUuid);
        await this.ports.markJoined(sheet.sheetUuid, party.uuid);
        this.ports.tellGm(`Tongs added ${sheet.playerName}'s ${sheet.sheetName} to ${party.name}.`);
      } catch (error) {
        await this.ports.markJoined(sheet.sheetUuid, party.uuid).catch(() => undefined);
        this.ports.tellGm(
          `Tongs could not add ${sheet.playerName}'s ${sheet.sheetName} to ${party.name}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }
}
