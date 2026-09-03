import { vi } from 'vitest';

import type { PartyAccessPorts } from '../../../src/ui/PartyAccessFlow.js';
import type { PartyCandidate } from '../../../src/foundry/PartyRoster.js';

/**
 * The world a GM sees when opening or closing parties. Extracted 2026-09-03 when the flow's own
 * test file crossed the size limit and split in two.
 *
 * ⚠️ `readParties` is a FUNCTION here rather than a captured array, and the race tests depend on
 * that: they change what it returns between drawing the list and tapping a row. A fixture that
 * snapshotted the array once would make those tests silently unable to express the thing they test.
 */
export const party = (name: string, over: Partial<PartyCandidate> = {}): PartyCandidate => ({
  uuid: `Actor.${name}`,
  name,
  isOwner: false,
  playerCreationEnabled: false,
  ...over,
});

export function ports(over: Partial<PartyAccessPorts> = {}): PartyAccessPorts {
  const host = document.createElement('div');
  document.body.append(host);
  return {
    document,
    host: () => host,
    readParties: () => [party('Alpha')],
    readViewer: () => ({ isGm: true }),
    setAccess: vi.fn(async () => Promise.resolve({ kind: 'set' as const, enabled: true })),
    report: vi.fn(),
    ...over,
  };
}

export const rows = (): HTMLButtonElement[] => [
  ...document.querySelectorAll<HTMLButtonElement>('button[data-choice]'),
];

export const screenText = (): string => document.body.textContent;
