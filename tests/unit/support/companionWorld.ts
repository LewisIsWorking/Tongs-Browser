import { Companions } from '../../../src/welcome/Companions.js';
import type { CompanionPorts } from '../../../src/welcome/Companions.js';
import type {
  CompanionCharacter,
  CompanionListing,
  ExistingCompanion,
} from '../../../src/welcome/companionDocuments.js';

/** A GM's world for `Companions`: one character, Lai's, in The Party, and every write recorded. 2026-10-12. */
export const KIBWE: CompanionCharacter = {
  id: 'A',
  uuid: 'Actor.A',
  name: 'Kibwe',
  ownerIds: ['u1'],
  slugs: ['animal-companion'],
  made: [],
  folderId: null,
};
export const PARTY = { uuid: 'Actor.P', name: 'The Party' };

export function world(
  characters: CompanionCharacter[] = [KIBWE],
  existing: ExistingCompanion[] = [],
  overrides: Partial<CompanionPorts> = {}
) {
  const created: string[] = [];
  const joined: string[] = [];
  const marks: string[] = [];
  const told: string[] = [];
  const whispers: string[] = [];
  const listing = (): CompanionListing => ({
    players: new Map([['u1', 'Lai']]),
    characters: characters.map((each) => ({
      ...each,
      made: [
        ...each.made,
        ...marks
          .filter((mark) => mark.startsWith(each.uuid))
          .map((m) => m.split('=')[1]!.split(',').at(-1)!),
      ],
    })),
    existing,
  });
  const ports: CompanionPorts = {
    isDesignatedGm: () => true,
    listing,
    partyOf: () => PARTY,
    packLabel: (pack) => `CC ${pack}`,
    create: async (companion) => {
      created.push(`${companion.name}:${companion.kind.actorType}`);
      return Promise.resolve(`Actor.NEW${String(created.length)}`);
    },
    join: async (party, uuid) => {
      joined.push(`${uuid}>${party}`);
      return Promise.resolve();
    },
    markMade: async (uuid, kinds) => {
      marks.push(`${uuid}=${kinds.join(',')}`);
      return Promise.resolve();
    },
    tellPlayers: async (ids, text) => {
      whispers.push(`${ids.join('+')}: ${text}`);
      return Promise.resolve();
    },
    tellGm: (text) => told.push(text),
    ...overrides,
  };
  return { companions: new Companions(ports), created, joined, marks, told, whispers };
}
