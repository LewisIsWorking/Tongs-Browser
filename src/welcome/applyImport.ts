import type { ImportBuild, ImportItem, ImportItemType } from './importBuild.js';

/**
 * Fills a new player's sheet from their ComeOnOverUno export. Added 2026-10-05.
 *
 * ⭐ Runs in the PLAYER's browser, on the sheet they now own. Measured live 2026-10-05: adding PF2e's Dwarf
 *    opens its "Clan Weapon" choice on the screen of whoever added it. Here that is the player, who is the
 *    one who should choose; run on the GM's browser the same prompt would wait, unseen, on the GM's screen.
 *
 * ⚠️ Every item is PF2e's own compendium document, found by name; the export only says WHICH. Nothing in
 *    the file becomes item data, except a lore skill's name and rank, which PF2e has no compendium for.
 *
 * ⚠️ Items already on the sheet are skipped, so an import cut short by a reload can simply run again, and
 *    features an ancestry or class grants by itself are not added twice.
 */
export interface ImportPorts {
  /** Whether the sheet already has an item of this type and name. */
  readonly has: (type: ImportItemType, name: string) => boolean;
  /** PF2e's compendium document for this type and name, as creation data, or null. */
  readonly find: (type: ImportItemType, name: string) => Promise<Record<string, unknown> | null>;
  readonly update: (data: Record<string, unknown>) => Promise<unknown>;
  /** Resolves once PF2e has made the item, which includes any choice it asks the player for. */
  readonly createItem: (data: Record<string, unknown>) => Promise<unknown>;
}

export interface ImportReport {
  /**
   * Every imported item now on the sheet, including those already there. ⚠️ Not only this run's: measured
   * live 2026-10-05, a run resumed after a reload said "Imported 3 items" of a build that had all 7 in.
   */
  readonly added: readonly string[];
  readonly missing: readonly string[];
  /** Spells are not added: a spell needs a spellcasting entry, which the export does not describe. */
  readonly spells: number;
}

/** Ancestry before heritage (a heritage belongs to one), and both before the class grants its features. */
const ORDER: readonly ImportItemType[] = [
  'ancestry',
  'heritage',
  'background',
  'class',
  'feat',
  'lore',
];
/** PF2e names a feat slot `<category>-<level>`; other categories land among bonus feats. */
const SLOTTED = ['ancestry', 'class', 'skill', 'general'];

export async function applyImport(build: ImportBuild, ports: ImportPorts): Promise<ImportReport> {
  await ports.update(sheetData(build));
  const added: string[] = [];
  const missing: string[] = [];
  for (const type of ORDER) {
    for (const item of build.items.filter((each) => each.type === type)) {
      if (ports.has(item.type, item.name)) {
        added.push(item.name);
        continue;
      }
      const data = item.type === 'lore' ? loreData(item) : await ports.find(item.type, item.name);
      if (data === null) {
        missing.push(item.name);
        continue;
      }
      try {
        await ports.createItem(withSlot(data, item));
        added.push(item.name);
      } catch {
        missing.push(item.name);
      }
    }
  }
  return { added, missing, spells: build.items.filter((item) => item.type === 'spell').length };
}

/** Level, and the export's final modifiers as PF2e's manual attributes, so no boost has to be re-chosen. */
function sheetData(build: ImportBuild): Record<string, unknown> {
  const { attributes } = build;
  return {
    'system.details.level.value': build.level,
    ...(attributes === null
      ? {}
      : {
          'system.build.attributes.manual': true,
          'system.abilities': Object.fromEntries(
            Object.entries(attributes).map(([key, mod]) => [key, { mod }])
          ),
        }),
    ...(build.keyAttribute === null
      ? {}
      : { 'system.details.keyability.value': build.keyAttribute }),
  };
}

function loreData(item: ImportItem): Record<string, unknown> {
  return { name: item.name, type: 'lore', system: { proficient: { value: item.level } } };
}

function withSlot(data: Record<string, unknown>, item: ImportItem): Record<string, unknown> {
  if (
    item.type !== 'feat' ||
    item.category === null ||
    !SLOTTED.includes(item.category) ||
    item.level < 1
  ) {
    return data;
  }
  const system = (data['system'] ?? {}) as Record<string, unknown>;
  return { ...data, system: { ...system, location: `${item.category}-${String(item.level)}` } };
}

/** One line for the player: what came across, and what they will need to add by hand. */
export function describeReport(report: ImportReport): string {
  const parts = [`Imported ${String(report.added.length)} items.`];
  if (report.missing.length > 0) {
    parts.push(`Not found, add by hand: ${report.missing.join(', ')}.`);
  }
  if (report.spells > 0) {
    parts.push(`Add your ${String(report.spells)} spells on the Spells tab.`);
  }
  return parts.join(' ');
}
