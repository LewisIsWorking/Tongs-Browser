import { MODULE_ID } from '../constants.js';
import { OWNER_LEVEL } from '../foundry/SheetCreationTypes.js';

/**
 * Users ComeOnOverUno says must own the world's primary party sheet. Added 2026-10-12.
 *
 * Lewis, 2026-10-12: "Anthony needs to be an owner of every world's primary party sheet (only that sheet,
 * don't be giving him ownership of every party sheet!)". He could not use the party stash, which PF2e only
 * lets a party's owners open. COO sends `partyOwners: ["<foundryUserId>", ...]` beside `playerCampaigns`, in
 * the GM heartbeat reply and to its helper GM (`helper.partyOwners(ids)`).
 *
 * ⛔ The PRIMARY party only: PF2e's `game.actors.party`, never any other party actor.
 * ⛔ Only ever RAISES a listed user to OWNER. Nobody is lowered or removed, and a user already OWNER is left
 *    alone with no update at all, so the `updateActor` it would fire cannot loop.
 * ⚠️ The designated GM's browser only, one pass at a time, like the welcome's GM side. A listed id that is
 *    not a user in this world, or a world with no primary party, is skipped without a word.
 */
export const PARTY_OWNERS_SETTING = 'partyOwners';

const MAX_ID = 64;

export interface OwnerSettings {
  register(namespace: string, key: string, data: object): void;
  get(namespace: string, key: string): unknown;
  set(namespace: string, key: string, value: unknown): Promise<unknown>;
}

export function registerPartyOwners(settings: OwnerSettings): void {
  settings.register(MODULE_ID, PARTY_OWNERS_SETTING, {
    scope: 'world',
    config: false,
    /* ⚠️ Kept as `{ ids }` under Object, the type the other COO settings use, not a bare Array. */
    type: Object,
    default: { ids: [] },
  });
}

/** Keeps non-empty strings of a sane length, once each, sorted. Anything else reads as nobody. */
export function readPartyOwners(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const ids = value.flatMap((id) =>
    typeof id === 'string' && id.trim() !== '' && id.length <= MAX_ID ? [id.trim()] : []
  );
  return [...new Set(ids)].sort();
}

/** Stores what COO said, only when it changed. A GM's browser only: a player cannot write a world setting. */
export async function storePartyOwners(settings: OwnerSettings, value: unknown): Promise<void> {
  const next = readPartyOwners(value);
  if (JSON.stringify(next) !== JSON.stringify(storedPartyOwners(settings))) {
    await settings.set(MODULE_ID, PARTY_OWNERS_SETTING, { ids: next });
  }
}

/** The users stored, read again as untrusted. */
export function storedPartyOwners(settings: OwnerSettings): string[] {
  const stored = settings.get(MODULE_ID, PARTY_OWNERS_SETTING) as
    { ids?: unknown } | null | undefined;
  return readPartyOwners(stored?.ids);
}

export interface PrimaryParty {
  readonly name: string;
  readonly ownership: Readonly<Record<string, number>>;
  update(data: object): Promise<unknown>;
}

export interface PartyOwnerPorts {
  readonly isDesignatedGm: () => boolean;
  readonly wanted: () => readonly string[];
  /** PF2e's active party, or null when the world has none. */
  readonly party: () => PrimaryParty | null;
  /** The user's name, or null when no such user is in this world. */
  readonly userName: (id: string) => string | null;
  readonly tellGm: (text: string) => void;
}

export class PartyOwners {
  private running = false;
  private again = false;

  public constructor(private readonly ports: PartyOwnerPorts) {}

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
    const party = this.ports.party();
    if (party === null) {
      return;
    }
    const raise = this.ports.wanted().flatMap((id) => {
      const name = this.ports.userName(id);
      return name !== null && (party.ownership[id] ?? 0) < OWNER_LEVEL ? [{ id, name }] : [];
    });
    if (raise.length === 0) {
      return;
    }
    await party.update(
      Object.fromEntries(raise.map((user) => [`ownership.${user.id}`, OWNER_LEVEL]))
    );
    this.ports.tellGm(
      `Tongs made ${raise.map((user) => user.name).join(' and ')} an owner of ${party.name}.`
    );
  }
}
