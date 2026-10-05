/**
 * A character exported from ComeOnOverUno's PF2e Character Creator or Viewer ("Foundry VTT" export), read
 * into the little the welcome needs. Added 2026-10-05, Lewis: "allow importing from ... PF2e-character-
 * creator / viewer".
 *
 * The export (`FoundryVttExportService` in ComeOnOverUno) is a Foundry actor whose items carry only a NAME
 * and a TYPE, plus final attribute modifiers. So nothing here is copied onto the sheet as data: each item
 * is looked up by name in PF2e's own compendiums (`applyImport.ts`), and only PF2e's documents are added.
 *
 * ⚠️ The file comes from a player, and travels on their user flag to the GM and back. It is untrusted the
 *    whole way: read with an allowlist of item types, lengths cut, numbers clamped, and read AGAIN by the
 *    browser that applies it (`readImportBuild`), never trusted because it was checked once.
 */
export const IMPORT_FLAG = 'importBuild';
export const IMPORT_DONE_FLAG = 'importDone';

export type ImportItemType =
  'ancestry' | 'heritage' | 'background' | 'class' | 'feat' | 'lore' | 'spell';
const ITEM_TYPES: readonly ImportItemType[] = [
  'ancestry',
  'heritage',
  'background',
  'class',
  'feat',
  'lore',
  'spell',
];
const ATTRIBUTES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
export type Attribute = (typeof ATTRIBUTES)[number];

export interface ImportItem {
  readonly type: ImportItemType;
  readonly name: string;
  /** Feats: the level they were taken at. Lore: the proficiency rank, 1 to 4. */
  readonly level: number;
  /** Feats only: ancestry, class, skill, general, archetype or bonus. */
  readonly category: string | null;
}

export interface ImportBuild {
  readonly name: string;
  readonly level: number;
  /** Final modifiers, applied as PF2e's manual attributes. Null when the export had none. */
  readonly attributes: Readonly<Record<Attribute, number>> | null;
  readonly keyAttribute: Attribute | null;
  readonly items: readonly ImportItem[];
}

const MAX_TEXT = 100;
const MAX_ITEMS = 300;
const CATEGORIES = ['ancestry', 'class', 'skill', 'general', 'archetype', 'bonus'];

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
const text = (value: unknown): string =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT) : '';
const whole = (value: unknown, low: number, high: number, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.min(high, Math.max(low, Math.round(value)))
    : fallback;
const isAttribute = (value: unknown): value is Attribute => ATTRIBUTES.includes(value as Attribute);

function readItem(raw: unknown): ImportItem | null {
  const item = record(raw);
  const type = item?.['type'];
  const name = text(item?.['name']);
  if (!ITEM_TYPES.includes(type as ImportItemType) || name === '') {
    return null;
  }
  const system = record(item?.['system']);
  const level =
    type === 'lore'
      ? whole(record(system?.['proficient'])?.['value'], 1, 4, 1)
      : whole(record(system?.['level'])?.['value'], 0, 20, 1);
  const category = system?.['category'];
  return {
    type: type as ImportItemType,
    name,
    level,
    category:
      type === 'feat' && CATEGORIES.includes(category as string) ? (category as string) : null,
  };
}

function readAttributes(raw: unknown): Record<Attribute, number> | null {
  const abilities = record(raw);
  if (abilities === null || !ATTRIBUTES.every((key) => record(abilities[key]) !== null)) {
    return null;
  }
  const entries = ATTRIBUTES.map((key) => [key, whole(record(abilities[key])?.['mod'], -5, 10, 0)]);
  return Object.fromEntries(entries) as Record<Attribute, number>;
}

/** Reads an export, or a build already read once. Null when it is not a PF2e character at all. */
export function readImportBuild(raw: unknown): ImportBuild | null {
  const actor = record(raw);
  const items = Array.isArray(actor?.['items']) ? (actor['items'] as unknown[]) : null;
  if (actor === null || items === null || (actor['type'] ?? 'character') !== 'character') {
    return null;
  }
  const system = record(actor['system']);
  const details = record(system?.['details']);
  const key = text(record(details?.['keyability'])?.['value']).toLowerCase();
  return {
    name: text(actor['name']),
    level: whole(record(details?.['level'])?.['value'], 1, 20, 1),
    attributes: readAttributes(system?.['abilities']),
    keyAttribute: isAttribute(key) ? key : null,
    items: items.slice(0, MAX_ITEMS).flatMap((item) => readItem(item) ?? []),
  };
}

/**
 * The build as it is stored on the request and the sheet: the export's own shape, cut down to what was
 * read, so the one reader above reads both and nothing else from the file rides along.
 */
export function storedImport(build: ImportBuild): Record<string, unknown> {
  const abilities =
    build.attributes === null
      ? null
      : Object.fromEntries(ATTRIBUTES.map((key) => [key, { mod: build.attributes?.[key] }]));
  return {
    name: build.name,
    type: 'character',
    system: {
      abilities,
      details: { level: { value: build.level }, keyability: { value: build.keyAttribute ?? '' } },
    },
    items: build.items.map((item) => ({
      type: item.type,
      name: item.name,
      system:
        item.type === 'lore'
          ? { proficient: { value: item.level } }
          : { level: { value: item.level }, category: item.category },
    })),
  };
}

/** "Level 1 Dwarf Fighter", for the welcome to show what it read. */
export function describeImport(build: ImportBuild): string {
  const named = (type: ImportItemType): string =>
    build.items.find((item) => item.type === type)?.name ?? '';
  const words = [named('ancestry'), named('class')].filter((word) => word !== '');
  return [`Level ${String(build.level)}`, ...words].join(' ');
}
