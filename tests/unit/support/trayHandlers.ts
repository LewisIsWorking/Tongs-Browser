import { vi } from 'vitest';

import { buildTrayActions, type TrayActionHandlers } from '../../../src/ui/TrayActions.js';
import type { TrayAction } from '../../../src/modifiers/TrayAction.js';

/**
 * A full set of tray handlers, every one a stub. Extracted 2026-09-02 when the tray suite crossed the
 * 200 line limit and the create button's gating moved into its own file.
 *
 * ⚠️ `canCreateSheets` defaults to TRUE so callers see the whole set of buttons. A default of false
 * would hide the create button from every test that does not mention it, and its absence would look
 * like the normal state, which is precisely the shape of a button that quietly stops existing.
 */
export const handlers = (overrides: Partial<TrayActionHandlers> = {}): TrayActionHandlers => ({
  toggleSidebar: vi.fn(),
  openCharacterSheet: vi.fn(),
  togglePause: vi.fn(),
  isPaused: () => false,
  isDragging: () => false,
  beginDrag: vi.fn(),
  endDrag: vi.fn(),
  whisperDiagnostics: vi.fn(),
  zoomBy: vi.fn(),
  panBy: vi.fn(),
  createSheet: vi.fn(),
  canCreateSheets: () => true,
  ...overrides,
});

/** The action with this id, or a failure that names it rather than an undefined dereference. */
export function findAction(given: Partial<TrayActionHandlers>, id: string): TrayAction {
  const action = buildTrayActions(handlers(given)).find((candidate) => candidate.id === id);
  if (action === undefined) {
    throw new Error(`No tray action with id '${id}'.`);
  }
  return action;
}

/** Every button id currently offered, which is what the gating assertions compare. */
export const actionIds = (given: Partial<TrayActionHandlers> = {}): string[] =>
  buildTrayActions(handlers(given)).map((action) => action.id);
