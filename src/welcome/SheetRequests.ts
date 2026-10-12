import type { SheetCreationOutcome } from '../foundry/SheetCreationTypes.js';
import { pickParty } from './campaignParty.js';
import type { CampaignParty } from './campaignParty.js';
import type { SheetRequest, SheetResult } from './sheetRequest.js';
import type { ImportBuild } from './importBuild.js';

/**
 * The GM's browser making the sheets new players asked for. Added 2026-10-05.
 *
 * ⚠️ Only the designated GM (`game.users.activeGM`) serves, so two GMs online make one sheet, not two.
 *
 * ⚠️ One pass at a time. Foundry fires `updateUser` for the answer this class itself writes, and a second
 *    pass started while the first is still creating would see the same request and make a duplicate. A call
 *    that arrives mid-pass asks for one more pass instead.
 *
 * ⛔ The sheet cap is ENFORCED here, not only in the player's browser (2026-10-12). A player may own 1
 *    counted sheet, or 2 with ComeOnOverUno's `extraSheets` (Lewis: "maximum 2 in total"); companion sheets
 *    never count. The welcome only hides itself at the cap, and a request is a flag any player can write.
 */
export interface PendingUser {
  readonly userId: string;
  readonly userName: string;
  readonly request: SheetRequest;
}

export interface NewSheet {
  readonly name: string;
  readonly ownerId: string;
  readonly partyUuid: string;
  readonly requestId: string;
  /** The player's ComeOnOverUno export, carried onto the sheet for their browser to apply. */
  readonly importBuild: ImportBuild | null;
}

export interface SheetRequestPorts {
  readonly isDesignatedGm: () => boolean;
  /** Players (never GMs) with a request on their user. */
  readonly pending: () => readonly PendingUser[];
  readonly campaignParties: () => readonly CampaignParty[];
  /** The campaigns a player posts in, from COO (`playerCampaigns.ts`). Picks between several parties. */
  readonly campaignsOf?: (userId: string) => readonly string[];
  /** The actor already made for this request, if a pass made it and then failed to answer. */
  readonly madeFor: (requestId: string) => string | null;
  /** How many counted sheets the player owns, and how many they may (`extraSheets.ts`). */
  readonly sheetCount?: (userId: string) => { readonly owned: number; readonly allowed: number };
  readonly create: (sheet: NewSheet) => Promise<SheetCreationOutcome>;
  /** Clears the request and writes the answer, on the player's user. */
  readonly answer: (userId: string, result: SheetResult) => Promise<void>;
  readonly tellGm: (text: string) => void;
}

export class SheetRequests {
  private running = false;
  private again = false;
  /** Waiting requests already explained to the GM, so a reconnect does not repeat the same notice. */
  private readonly told = new Set<string>();

  public constructor(private readonly ports: SheetRequestPorts) {}

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
        for (const user of this.ports.pending()) {
          await this.serveOne(user);
        }
      } while (this.askedAgain());
    } finally {
      this.running = false;
    }
  }

  /** A method, not a field read: the compiler cannot see the hooks that set it while a pass awaits. */
  private askedAgain(): boolean {
    return this.again;
  }

  private async serveOne(user: PendingUser): Promise<void> {
    const { request } = user;
    const made = this.ports.madeFor(request.id);
    if (made !== null) {
      await this.ports.answer(user.userId, {
        kind: 'created',
        requestId: request.id,
        actorUuid: made,
      });
      return;
    }
    const count = this.ports.sheetCount?.(user.userId);
    if (count !== undefined && count.owned >= count.allowed) {
      await this.refuseAtCap(user, count.allowed);
      return;
    }

    const pick = pickParty(
      request.partyUuid,
      this.ports.campaignParties(),
      this.ports.campaignsOf?.(user.userId)
    );
    if (pick.kind !== 'party') {
      this.waitWithNotice(user, pick.kind === 'none');
      return;
    }

    const outcome = await this.ports.create({
      name: request.name,
      ownerId: user.userId,
      partyUuid: pick.party.uuid,
      requestId: request.id,
      importBuild: request.importBuild,
    });
    if (outcome.kind === 'notCreated') {
      await this.ports.answer(user.userId, {
        kind: 'refused',
        requestId: request.id,
        reason: outcome.reason,
      });
      this.ports.tellGm(`Tongs could not make ${user.userName}'s character: ${outcome.reason}`);
      return;
    }

    await this.ports.answer(user.userId, {
      kind: 'created',
      requestId: request.id,
      actorUuid: outcome.sheet.uuid ?? '',
    });
    this.ports.tellGm(
      outcome.kind === 'created'
        ? `Tongs made ${request.name} for ${user.userName}, in ${pick.party.name}.`
        : `Tongs made ${request.name} for ${user.userName}, but could not add it to ${pick.party.name}: ${outcome.reason}`
    );
  }

  /** Turned down with the reason, so the player is told rather than left waiting. */
  private async refuseAtCap(user: PendingUser, allowed: number): Promise<void> {
    await this.ports.answer(user.userId, {
      kind: 'refused',
      requestId: user.request.id,
      reason:
        allowed > 1
          ? `You already have ${String(allowed)} character sheets here, which is the most anyone can have.`
          : "You already have a character sheet here. For a second one, send /extrasheet in your campaign's Telegram topic.",
    });
    this.ports.tellGm(
      `${user.userName} asked for another character, but already has ${String(allowed)}, the most they may have here.`
    );
  }

  /** ⚠️ The request is KEPT: marking a party, or the player choosing one, lets the next pass finish it. */
  private waitWithNotice(user: PendingUser, noParty: boolean): void {
    if (this.told.has(user.request.id)) {
      return;
    }
    this.told.add(user.request.id);
    this.ports.tellGm(
      noParty
        ? `${user.userName} asked for a character, but this world has no party. Create one (PF2e makes it the primary party), or set a campaign in Tongs' party campaigns, and it will be made.`
        : `${user.userName} asked for a character, but this world has several campaign parties. Ask them to choose one in the welcome window.`
    );
  }
}
