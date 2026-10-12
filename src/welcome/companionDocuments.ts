import { MODULE_ID } from '../constants.js';
import { OWNER_LEVEL } from '../foundry/SheetCreationTypes.js';
import {
  COMPANION_MODULE,
  COMPANIONS_MADE_FLAG,
  COMPANION_OF_FLAG,
  companionKindOf,
} from './companionKinds.js';

/**
 * Every actor listing companion sheets make. Added 2026-10-12, and in `check:documents`' BOUNDARY because
 * it enumerates users and actors.
 *
 * ⛔ GM only, failing closed on `game.user.isGM !== true`: a GM can already open everything it lists, and
 *    a player's browser gets an empty listing. `isCompanionSheet` reads one actor already in hand.
 */
export interface CompanionItem {
  readonly slug?: string | null;
  readonly system?: { readonly slug?: string | null };
}

export interface CompanionActor {
  readonly id: string | null;
  readonly uuid: string;
  readonly name: string | null;
  readonly type: string;
  readonly ownership?: Readonly<Record<string, number>>;
  readonly items?: { readonly contents?: readonly CompanionItem[] };
  /** PF2e's ancestry item; a Companion Compendia companion's comes from that module's packs. */
  readonly ancestry?: unknown;
  /** A PF2e familiar's master. */
  readonly system?: { readonly master?: { readonly id?: string | null } };
  getFlag?(scope: string, key: string): unknown;
}

export interface CompanionGame {
  readonly user?: { readonly isGM?: boolean };
  readonly users?: {
    readonly contents: readonly {
      readonly id: string | null;
      readonly name?: string | null;
      readonly isGM?: boolean;
      readonly role?: number;
    }[];
  };
  readonly actors?: { readonly contents: readonly CompanionActor[] };
}

/** A character a player owns, with what its items grant. */
export interface CompanionCharacter {
  readonly id: string;
  readonly uuid: string;
  readonly name: string;
  readonly ownerIds: readonly string[];
  readonly slugs: readonly string[];
  /** The kinds Tongs already made for it (`companionsMade`). */
  readonly made: readonly string[];
}

/** A companion that exists: for one character (`of`), or made by hand for whoever owns it (`of` null). */
export interface ExistingCompanion {
  readonly of: string | null;
  readonly ownerIds: readonly string[];
  readonly kinds: readonly string[];
}

export interface CompanionListing {
  readonly players: ReadonlyMap<string, string>;
  readonly characters: readonly CompanionCharacter[];
  readonly existing: readonly ExistingCompanion[];
}

/** A sheet as far as telling a companion needs: its flags, and PF2e's ancestry item. */
export type MaybeCompanion = Pick<CompanionActor, 'ancestry' | 'getFlag'>;

interface AncestrySource {
  readonly _stats?: { readonly compendiumSource?: unknown };
  readonly flags?: { readonly core?: { readonly sourceId?: unknown } };
}

/** Where a sheet's ancestry came from: Companion Compendia's packs mark a hand-made companion. */
function ancestrySource(actor: MaybeCompanion): string {
  const ancestry = actor.ancestry as AncestrySource | null | undefined;
  const source = ancestry?._stats?.compendiumSource ?? ancestry?.flags?.core?.sourceId;
  return typeof source === 'string' ? source : '';
}

/** The kinds a hand-made Companion Compendia sheet stands for, by the pack its ancestry came from. */
function handMadeKinds(actor: MaybeCompanion): string[] {
  const source = ancestrySource(actor);
  if (!source.startsWith(`Compendium.${COMPANION_MODULE}.`)) return [];
  if (source.includes('AC-Eidolons')) return ['eidolon'];
  if (source.includes('AC-Construct-Companions')) return ['construct-companion'];
  return ['animal-companion', 'undead-companion'];
}

/**
 * A companion's sheet, never counted toward a player's sheets: one Tongs made (`companionOf`), or one a
 * player built from Companion Compendia by hand (its ancestry is from that module's packs).
 */
export function isCompanionSheet(actor: MaybeCompanion): boolean {
  return (
    companionKindOf(actor.getFlag?.bind(actor), MODULE_ID) !== null ||
    handMadeKinds(actor).length > 0
  );
}

const owners = (actor: CompanionActor, players: ReadonlyMap<string, string>): string[] =>
  Object.entries(actor.ownership ?? {}).flatMap(([id, level]) =>
    level === OWNER_LEVEL && players.has(id) ? [id] : []
  );

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((each): each is string => typeof each === 'string') : [];

/** GM only: the players, their characters with what the characters' items grant, and companions that exist. */
export function companionListing(game: CompanionGame | undefined): CompanionListing {
  const players = new Map<string, string>();
  if (game?.user?.isGM !== true) {
    return { players, characters: [], existing: [] };
  }
  for (const user of game.users?.contents ?? []) {
    if (user.isGM !== true && user.id !== null && (user.role ?? 0) >= 1) {
      players.set(user.id, user.name ?? 'A player');
    }
  }
  const characters: CompanionCharacter[] = [];
  const existing: ExistingCompanion[] = [];
  for (const actor of game.actors?.contents ?? []) {
    const ownerIds = owners(actor, players);
    const kind = companionKindOf(actor.getFlag?.bind(actor), MODULE_ID);
    if (kind !== null) {
      existing.push({
        of: String(actor.getFlag?.(MODULE_ID, COMPANION_OF_FLAG)),
        ownerIds,
        kinds: [kind],
      });
    } else if (actor.type === 'familiar' && typeof actor.system?.master?.id === 'string') {
      /* A familiar somebody made by hand, linked to its master: it is the familiar (or pet) already. */
      existing.push({
        of: `Actor.${actor.system.master.id}`,
        ownerIds,
        kinds: ['familiar', 'pet'],
      });
    } else if (handMadeKinds(actor).length > 0) {
      existing.push({ of: null, ownerIds, kinds: handMadeKinds(actor) });
    } else if (actor.type === 'character' && actor.id !== null && ownerIds.length > 0) {
      characters.push({
        id: actor.id,
        uuid: actor.uuid,
        name: actor.name ?? 'A character',
        ownerIds,
        slugs: (actor.items?.contents ?? []).flatMap((item) => {
          const slug = item.system?.slug ?? item.slug;
          return typeof slug === 'string' ? [slug] : [];
        }),
        made: strings(actor.getFlag?.(MODULE_ID, COMPANIONS_MADE_FLAG)),
      });
    }
  }
  return { players, characters, existing };
}
