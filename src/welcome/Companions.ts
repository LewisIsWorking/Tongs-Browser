import { companionKindsFor } from './companionKinds.js';
import type { CompanionKind } from './companionKinds.js';
import type { CompanionCharacter, CompanionListing } from './companionDocuments.js';

/**
 * The GM's browser making a sheet for each companion a player's character has. Added 2026-10-12.
 *
 * Lewis, 2026-10-12: companion sheets are made AUTOMATICALLY, owned by the player, in the party, the GM is
 * told, and they never count toward the 2-sheet cap. What grants a companion, and which actor type each
 * gets, is in `companionKinds.ts`.
 *
 * ⛔ Only the designated GM's browser, one pass at a time, like SheetRequests: creating a companion fires
 *    `createActor` and the mark fires `updateActor`, both of which wake this again mid-pass.
 * ⛔ Made ONCE per character and kind. The kind goes into the character's `companionsMade` right after the
 *    create, so a companion a GM deleted is never made again; a companion that exists (Tongs' flags, a
 *    familiar whose master is the character, or a Companion Compendia sheet its player built by hand) is
 *    only marked, never made twice.
 * ⚠️ Only characters IN A PARTY, so an old world's retired sheets do not each sprout a familiar the day
 *    this ships. A sheet joins a party when it is made by the welcome, or by PartyHomes.
 * ⚠️ A failed create is not retried until the page reloads, so a broken world does not try on every hook.
 */
export interface NewCompanion {
  readonly name: string;
  readonly kind: CompanionKind;
  readonly character: CompanionCharacter;
}

export interface CompanionPorts {
  readonly isDesignatedGm: () => boolean;
  readonly listing: () => CompanionListing;
  /** The party a sheet is a member of, if any. */
  readonly partyOf: (sheetUuid: string) => { readonly uuid: string; readonly name: string } | null;
  /** The Companion Compendia pack's label, by name, or null when this world does not have it. */
  readonly packLabel: (pack: string) => string | null;
  /** Makes the actor, owned by the character's owners and flagged; resolves to its uuid. Throws on failure. */
  readonly create: (companion: NewCompanion) => Promise<string>;
  readonly join: (partyUuid: string, sheetUuid: string) => Promise<void>;
  readonly markMade: (characterUuid: string, kinds: readonly string[]) => Promise<void>;
  /** A whisper to the character's owners, saying what to do with the new sheet. */
  readonly tellPlayers: (userIds: readonly string[], text: string) => Promise<void>;
  readonly tellGm: (text: string) => void;
}

const message = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export class Companions {
  private running = false;
  private again = false;
  private readonly failed = new Set<string>();

  public constructor(private readonly ports: CompanionPorts) {}

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
    const listing = this.ports.listing();
    for (const character of listing.characters) {
      const party = this.ports.partyOf(character.uuid);
      if (party === null) {
        continue;
      }
      const made = [...character.made];
      for (const kind of companionKindsFor(character.slugs)) {
        const key = `${character.uuid}:${kind.kind}`;
        if (made.includes(kind.kind) || this.failed.has(key)) {
          continue;
        }
        if (!exists(listing, character, kind.kind)) {
          const ok = await this.make(listing, character, kind, party);
          if (!ok) {
            this.failed.add(key);
            continue;
          }
        }
        made.push(kind.kind);
        await this.ports.markMade(character.uuid, made);
      }
    }
  }

  private async make(
    listing: CompanionListing,
    character: CompanionCharacter,
    kind: CompanionKind,
    party: { readonly uuid: string; readonly name: string }
  ): Promise<boolean> {
    const name = `${character.name}'s ${kind.label}`;
    const who = character.ownerIds.map((id) => listing.players.get(id) ?? 'a player').join(' and ');
    let uuid: string;
    try {
      uuid = await this.ports.create({ name, kind, character });
    } catch (error) {
      this.ports.tellGm(`Tongs could not make ${name} for ${who}: ${message(error)}`);
      return false;
    }
    const notes: string[] = [];
    await this.ports.join(party.uuid, uuid).catch((error: unknown) => {
      notes.push(` It could not join ${party.name}: ${message(error)}`);
    });
    const label = kind.pack === null ? null : this.ports.packLabel(kind.pack);
    if (kind.pack !== null && label === null) {
      notes.push(
        ` Companion Compendia's "${kind.pack}" pack is missing here; Tongs assumes the pf2e-animal-companions module is active.`
      );
    }
    this.ports.tellGm(`Tongs made ${name} for ${who}.${notes.join('')}`);
    await this.ports
      .tellPlayers(character.ownerIds, playerHint(name, kind, label))
      .catch(() => undefined);
    return true;
  }
}

/** A companion that already exists for this character, so it is only marked. */
function exists(listing: CompanionListing, character: CompanionCharacter, kind: string): boolean {
  return listing.existing.some(
    (each) =>
      each.kinds.includes(kind) &&
      (each.of === character.uuid ||
        (each.of === null && each.ownerIds.some((id) => character.ownerIds.includes(id))))
  );
}

/** What the player is told: the sheet is theirs, and what it still needs. */
export function playerHint(name: string, kind: CompanionKind, packLabel: string | null): string {
  const made = `Tongs made ${name} for you, in your party.`;
  if (kind.actorType === 'familiar') {
    return `${made} Open it and choose its ${kind.kind === 'pet' ? 'pet' : 'familiar'} abilities.`;
  }
  if (kind.pack === null) {
    return `${made} Open it and build it from your ${kind.label.toLowerCase()}'s rules.`;
  }
  const undead =
    kind.kind === 'undead-companion'
      ? ' It uses an animal companion ancestry, with the undead trait.'
      : '';
  return packLabel === null
    ? `${made} Its ancestry comes from the Companion Compendia module, which is not on in this world yet; ask your GM.${undead}`
    : `${made} Open it and drag your ${kind.label.toLowerCase()}'s ancestry onto it from the "${packLabel}" compendium (Companion Compendia).${undead}`;
}
