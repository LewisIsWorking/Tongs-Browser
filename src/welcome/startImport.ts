import { MODULE_ID } from '../constants.js';
import { logger } from '../core/Logger.js';
import { applyImport, describeReport } from './applyImport.js';
import type { ImportPorts } from './applyImport.js';
import { IMPORT_DONE_FLAG, IMPORT_FLAG, readImportBuild } from './importBuild.js';
import type { ImportItemType } from './importBuild.js';
import type { WelcomeHooks } from './startSheetRequests.js';
import { ownCharacters } from './welcomeDocuments.js';
import type { WelcomeActor, WelcomeGame } from './welcomeDocuments.js';

/**
 * Applies a ComeOnOverUno export to the sheet a GM made for it, in the owning player's browser. Added
 * 2026-10-05; why the player's browser is in `applyImport.ts`.
 *
 * ⚠️ Once per sheet: `importDone` is set when it finishes, and a sheet being imported in this browser is
 *    not started twice. A reload part way through simply runs it again, and items already on the sheet
 *    are skipped. Two tabs of the same new player at once could both run it; that is the accepted gap.
 */
export interface ImportSheet extends WelcomeActor {
  readonly items?: {
    readonly contents?: readonly { readonly type?: string; readonly name?: string }[];
  };
  update?(data: Record<string, unknown>): Promise<unknown>;
  createEmbeddedDocuments?(type: string, data: readonly object[]): Promise<unknown>;
}

interface Pack {
  getIndex(): Promise<Iterable<{ readonly _id: string; readonly name: string }>>;
  getDocument(
    id: string
  ): Promise<{ readonly uuid?: string; toObject(): Record<string, unknown> } | null>;
}

export interface ImportGlobals {
  readonly game?: WelcomeGame & { readonly packs?: { get(id: string): Pack | undefined } };
  readonly ui?: { readonly notifications?: { info?(message: string): unknown } };
}

/** Where PF2e keeps each kind of item. Measured on PF2e 8.5, 2026-10-05. */
const PACKS: Partial<Record<ImportItemType, string>> = {
  ancestry: 'pf2e.ancestries',
  heritage: 'pf2e.heritages',
  background: 'pf2e.backgrounds',
  class: 'pf2e.classes',
  feat: 'pf2e.feats-srd',
};

/** Names compared loosely: case, runs of spaces and curly apostrophes differ between the two apps. */
export const sameName = (a: string, b: string): boolean => {
  const plain = (value: string): string =>
    value.toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim();
  return plain(a) === plain(b);
};

export function startImport(hooks: WelcomeHooks, globals: ImportGlobals): void {
  if (globals.game?.user?.isGM === true) {
    return;
  }
  const running = new Set<string>();

  const run = (): void => {
    for (const sheet of ownCharacters(globals.game) as ImportSheet[]) {
      const build = readImportBuild(sheet.getFlag?.(MODULE_ID, IMPORT_FLAG));
      if (
        build === null ||
        sheet.getFlag?.(MODULE_ID, IMPORT_DONE_FLAG) === true ||
        running.has(sheet.uuid)
      ) {
        continue;
      }
      running.add(sheet.uuid);
      void applyImport(build, sheetPorts(sheet, globals))
        .then(async (report) => {
          await sheet.setFlag?.(MODULE_ID, IMPORT_DONE_FLAG, true);
          globals.ui?.notifications?.info?.(describeReport(report));
        })
        .catch((error: unknown) => {
          logger.warn(`Import failed: ${error instanceof Error ? error.message : String(error)}`);
        })
        .finally(() => running.delete(sheet.uuid));
    }
  };
  for (const name of ['createActor', 'updateActor', 'updateUser']) {
    hooks.on(name, run);
  }
  run();
}

function sheetPorts(sheet: ImportSheet, globals: ImportGlobals): ImportPorts {
  return {
    has: (type, name) =>
      (sheet.items?.contents ?? []).some(
        (item) => item.type === type && sameName(item.name ?? '', name)
      ),
    find: async (type, name) => {
      const id = PACKS[type];
      const pack = id === undefined ? undefined : globals.game?.packs?.get(id);
      if (pack === undefined) {
        return null;
      }
      const entry = [...(await pack.getIndex())].find((each) => sameName(each.name, name));
      const doc = entry === undefined ? null : await pack.getDocument(entry._id);
      if (doc === null) {
        return null;
      }
      /* Linked to its compendium entry, as a drag from the compendium would be. */
      const data = doc.toObject();
      const stats = (data['_stats'] ?? {}) as Record<string, unknown>;
      return { ...data, _stats: { ...stats, compendiumSource: doc.uuid ?? null } };
    },
    update: async (data) => sheet.update?.(data),
    createItem: async (data) => sheet.createEmbeddedDocuments?.('Item', [data]),
  };
}
