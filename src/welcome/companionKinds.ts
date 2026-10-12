/**
 * Which feats and class features give a character a companion, and what sheet each companion gets.
 * Added 2026-10-12.
 *
 * Lewis, 2026-10-12: "Maybe TONGS could detect someone having a familiar/eidolon/animal companion/undead
 * companion/etc and assign them a sheet for it (actor for animal/undead/eidolon, familiar sheet for familiar)".
 * And: "This module should be active on all worlds: pf2e-animal-companions ... our modules should always
 * assume this module is active." ⚠️ So Tongs ASSUMES PF2e Companion Compendia (`pf2e-animal-companions`) is
 * active, and only says so to the GM, never crashes, when a pack it names is missing (`Companions.ts`).
 *
 * ⭐ Detected by SLUG, read from PF2e's own packs (foundryvtt/pf2e at 581c2bf, 2026-10-07, and SF2e's).
 *    The pack sources carry no slug; PF2e's build writes `system.slug = sluggify(name)`
 *    (build/lib/compendium-pack.ts), so "Familiar (Witch)" is `familiar-witch` on every sheet.
 *    Only items that GRANT a companion are listed, found by "You gain a familiar", "the service of a young
 *    animal companion" and the like, and then read one by one. Upgrades (Mature, Incredible, Enhanced
 *    Familiar) and feats that change a companion you already have are left out on purpose:
 *    - dhampir's `undead-companion` turns an existing companion undead; it grants none, so it is ignored;
 *    - `psychopomp-familiar` and the elementalist's `elemental-familiar` change an existing familiar.
 *    Granting chains are covered either way: Animal Order grants `animal-companion`, Improved Familiar
 *    Attunement grants `familiar`, Familiar grants `pet`, Summoner Dedication grants `eidolon`.
 *
 * ⭐ The actor type, by kind:
 *    - familiar, pet: PF2e's own `familiar` actor, with `system.master.id` set to the character. It is the
 *      sheet PF2e built for both (the remaster Pet is the familiar base without abilities), and the master
 *      link gives it its saves and AC. PF2e's iconic familiars (Feiya's Daji) are this type.
 *    - animal, undead and construct companions, eidolons, drones: a `character` actor. PF2e has no
 *      companion actor type; its own iconic companion (Lini's Droogami, iconics/lini) is a `character` with
 *      ancestry "Cat" and class "Animal Companion", and Companion Compendia builds animal companions,
 *      construct companions and eidolons the same way, from an ANCESTRY item in its packs. Undead Master's
 *      companion "utilizes the rules for animal companions", so it takes the same sheet and ancestries.
 *      Which animal or eidolon is the player's choice, so no ancestry is guessed: the player is told which
 *      pack to drag it from.
 */
export const COMPANION_OF_FLAG = 'companionOf';
export const COMPANION_KIND_FLAG = 'companionKind';
/** On the character: the kinds Tongs made once, so one a GM deleted is never made again. */
export const COMPANIONS_MADE_FLAG = 'companionsMade';

/** The Companion Compendia module, and its packs by NAME (labels differ); SF2e worlds prefix `sf-`. */
export const COMPANION_MODULE = 'pf2e-animal-companions';

export interface CompanionKind {
  readonly kind: string;
  readonly label: string;
  readonly actorType: 'familiar' | 'character';
  /** The Companion Compendia pack the player drags its ancestry from; none for familiars and drones. */
  readonly pack: string | null;
  readonly slugs: readonly string[];
}

export const COMPANION_KINDS: readonly CompanionKind[] = [
  {
    kind: 'familiar',
    label: 'Familiar',
    actorType: 'familiar',
    pack: null,
    slugs: [
      'familiar', // magus, sorcerer, thaumaturge, wizard; also SF2e's technomancer
      'familiar-witch',
      'improved-familiar-attunement', // wizard thesis
      'witch-dedication',
      'familiar-master-dedication',
      'alchemical-familiar',
      'leshy-familiar', // druid
      'undead-familiar', // necromancer
      'elemental-familiar-kineticist',
      'glyph-familiar', // runesmith
      'spirit-familiar-animist',
      'draconic-familiar',
      'emissary-familiar',
      'mask-familiar',
      'animal-accomplice', // gnome
      'hyena-familiar', // kholo
      'rat-familiar', // ratfolk
      'crocodiles-twin', // lizardfolk
      'minuscule-mentee', // poppet
      'marine-ally', // azarketi
      'star-orb', // kitsune
    ],
  },
  { kind: 'pet', label: 'Pet', actorType: 'familiar', pack: null, slugs: ['pet'] },
  {
    kind: 'animal-companion',
    label: 'Animal Companion',
    actorType: 'character',
    pack: 'AC-Ancestries-and-Class',
    slugs: [
      'animal-companion', // druid (Animal Order grants it)
      'animal-companion-ranger',
      'commanders-companion',
      'faithful-steed', // champion
      'beastmaster-dedication',
      'animal-trainer-dedication',
      'cavalier-dedication',
      'drake-rider-dedication',
      'mammoth-lord-dedication',
      'demon-hunting-companion',
      'spirit-companion',
    ],
  },
  {
    kind: 'undead-companion',
    label: 'Undead Companion',
    actorType: 'character',
    pack: 'AC-Ancestries-and-Class',
    slugs: ['undead-master-dedication'],
  },
  {
    kind: 'construct-companion',
    label: 'Construct Companion',
    actorType: 'character',
    pack: 'AC-Construct-Companions',
    slugs: [
      'construct-innovation', // inventor
      'prototype-companion',
      'clockwork-reanimator-dedication',
      'rise-my-creature',
    ],
  },
  {
    kind: 'eidolon',
    label: 'Eidolon',
    actorType: 'character',
    pack: 'AC-Eidolons',
    slugs: ['eidolon', 'summoner-dedication'],
  },
  /* SF2e's mechanic: "a commercial robot companion called a drone". No Companion Compendia pack for it. */
  { kind: 'drone', label: 'Drone', actorType: 'character', pack: null, slugs: ['drone'] },
];

/**
 * The companion kinds a character's items grant, in table order. ⚠️ A familiar holder also carries `pet`
 * (Familiar grants Pet), so a pet is only its own companion when there is no familiar.
 */
export function companionKindsFor(slugs: readonly string[]): CompanionKind[] {
  const have = new Set(slugs);
  const found = COMPANION_KINDS.filter((entry) => entry.slugs.some((slug) => have.has(slug)));
  return found.some((entry) => entry.kind === 'familiar')
    ? found.filter((entry) => entry.kind !== 'pet')
    : found;
}

/** The pack's full id for this system: `pf2e-animal-companions.AC-Eidolons`, or `...sf-AC-Eidolons`. */
export function companionPackId(pack: string, systemId: string | undefined): string {
  return `${COMPANION_MODULE}.${systemId === 'sf2e' ? 'sf-' : ''}${pack}`;
}

/** The kind Tongs marked a companion sheet with, or null when it is not one. */
export function companionKindOf(
  getFlag: ((scope: string, key: string) => unknown) | undefined,
  scope: string
): string | null {
  const of = getFlag?.(scope, COMPANION_OF_FLAG);
  const kind = getFlag?.(scope, COMPANION_KIND_FLAG);
  return typeof of === 'string' && typeof kind === 'string' ? kind : null;
}
