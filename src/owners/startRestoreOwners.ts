import { MODULE_ID } from '../constants.js';
import { escapeHtml, registerGmMenu } from '../bands/settingsMenu.js';
import type { MenuGlobals, MenuSettings } from '../bands/settingsMenu.js';
import { describeGroup, orphanGroups, ownershipUpdates } from './orphanOwners.js';
import type { OwnedDoc } from './orphanOwners.js';

/**
 * The GM's "Restore owners" button. Added 2026-09-29; the rules are in orphanOwners.ts.
 *
 * ⚠️ The GM's answers are saved per world, so opening it again shows what was chosen, and choosing again is
 *    harmless: the same update twice sets the same level twice.
 */
const CHOICES_SETTING = 'restoredOwners';
/** The world collections whose documents carry per-user ownership. */
const COLLECTIONS = [
  'Actor',
  'Item',
  'JournalEntry',
  'Scene',
  'Macro',
  'Cards',
  'RollTable',
  'Playlist',
];

export interface OwnerSettings extends MenuSettings {
  register(namespace: string, key: string, data: object): void;
  get(namespace: string, key: string): unknown;
  set(namespace: string, key: string, value: unknown): Promise<unknown>;
}

interface WorldDoc {
  readonly id: string | null;
  readonly name?: string | null;
  readonly type?: string;
  readonly ownership?: Readonly<Record<string, number>>;
}

interface WorldCollection {
  readonly contents: readonly WorldDoc[];
  readonly documentClass: { updateDocuments(updates: object[]): Promise<unknown> };
}

export interface OwnerGlobals extends MenuGlobals {
  readonly game?: {
    readonly user?: { readonly isGM?: boolean };
    readonly users?: {
      readonly contents: readonly { readonly id: string | null; readonly name?: string | null }[];
    };
    readonly collections?: { get(name: string): WorldCollection | undefined };
  };
  readonly foundry?: MenuGlobals['foundry'] & {
    readonly applications?: {
      readonly api?: { readonly DialogV2?: { input?(options: object): Promise<unknown> } };
    };
  };
  readonly ui?: {
    readonly notifications?: { info?(message: string): unknown; warn?(message: string): unknown };
  };
}

function readWorldDocs(globals: OwnerGlobals): OwnedDoc[] {
  return COLLECTIONS.flatMap((collection) =>
    (globals.game?.collections?.get(collection)?.contents ?? []).flatMap((doc) =>
      doc.id === null
        ? []
        : [
            {
              collection,
              id: doc.id,
              name: doc.name ?? '(unnamed)',
              type: doc.type ?? '',
              ownership: doc.ownership ?? {},
            },
          ]
    )
  );
}

/** Opens the dialog and applies the GM's answers. Resolves to how many documents were updated, or null. */
export async function restoreOwners(
  settings: OwnerSettings,
  globals: OwnerGlobals
): Promise<number | null> {
  /* ⛔ GM only, failing closed: it lists every user and document in the world. The menu is restricted too. */
  if (globals.game?.user?.isGM !== true) {
    return null;
  }
  const notify = globals.ui?.notifications;
  const users = (globals.game.users?.contents ?? []).flatMap((u) =>
    u.id === null ? [] : [{ id: u.id, name: u.name ?? u.id }]
  );
  const userIds = new Set(users.map((u) => u.id));
  const groups = orphanGroups(readWorldDocs(globals), userIds);
  if (groups.length === 0) {
    notify?.info?.('Everything in this world is owned by a current user. Nothing to restore.');
    return null;
  }
  const saved = (settings.get(MODULE_ID, CHOICES_SETTING) ?? {}) as Record<string, string>;
  const options = (oldId: string) =>
    ['<option value="">Leave alone</option>']
      .concat(
        users.map(
          (u) =>
            `<option value="${escapeHtml(u.id)}"${saved[oldId] === u.id ? ' selected' : ''}>${escapeHtml(u.name)}</option>`
        )
      )
      .join('');
  const rows = groups
    .map(
      (g) =>
        `<label><span>${String(g.docs.length)} owned: ${escapeHtml(describeGroup(g))}</span> ` +
        `<select name="${escapeHtml(g.oldId)}">${options(g.oldId)}</select></label>`
    )
    .join('');
  const answer = (await globals.foundry?.applications?.api?.DialogV2?.input?.({
    window: { title: 'Restore owners from before the move' },
    content:
      '<p>Each row is a player whose old Foundry user was removed in the move off The Forge, and what they ' +
      'owned. Choose who they are now; they get the same access back. Nothing is taken from anyone.</p>' +
      `<div class="tb-party-campaigns">${rows}</div>`,
    ok: { label: 'Restore' },
  })) as Record<string, unknown> | null | undefined;
  if (answer === null || answer === undefined) {
    return null;
  }
  const choices = Object.fromEntries(
    groups.flatMap((g) => {
      const to = answer[g.oldId];
      return typeof to === 'string' && userIds.has(to) ? [[g.oldId, to]] : [];
    })
  );
  const updates = ownershipUpdates(groups, choices, userIds);
  for (const collection of COLLECTIONS) {
    const batch = updates.filter((u) => u.collection === collection).map((u) => u.update);
    if (batch.length > 0) {
      await globals.game.collections?.get(collection)?.documentClass.updateDocuments(batch);
    }
  }
  await settings.set(MODULE_ID, CHOICES_SETTING, { ...saved, ...choices });
  notify?.info?.(
    `Restored owners on ${String(updates.length)} ${updates.length === 1 ? 'document' : 'documents'}.`
  );
  return updates.length;
}

export function startRestoreOwners(settings: OwnerSettings, globals: OwnerGlobals): boolean {
  settings.register(MODULE_ID, CHOICES_SETTING, {
    scope: 'world',
    config: false,
    type: Object,
    default: {},
  });
  return registerGmMenu(
    settings,
    globals,
    {
      key: 'restoreOwnersMenu',
      name: 'Restore owners',
      label: 'Restore owners',
      hint: 'Give players back the characters, items and journals their pre-move Foundry user owned.',
      icon: 'fas fa-user-check',
    },
    async () => restoreOwners(settings, globals)
  );
}
