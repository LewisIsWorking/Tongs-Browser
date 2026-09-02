import { vi } from 'vitest';

import type { CreateSheetPorts } from '../../../src/ui/CreateSheetFlow.js';
import type { PartyCandidate } from '../../../src/foundry/PartyRoster.js';

/**
 * A create-sheet flow with every port stubbed. Extracted 2026-09-02 when the flow suite crossed the
 * 200 line limit and split into choosing and outcomes.
 *
 * ⚠️ The default party has `playerCreationEnabled: false`, which is the honest default and also a
 * trap worth knowing about: a test that uses the PLAYER viewer with this party gets `notAllowed` and
 * never reaches creation. The first draft of the outcome tests failed for exactly that reason, and it
 * was the fixture at fault rather than the flow. Use `openParty()` when the viewer is a player.
 */
export const party = (name: string, over: Partial<PartyCandidate> = {}): PartyCandidate => ({
  uuid: `Actor.${name}`,
  name,
  isOwner: false,
  playerCreationEnabled: false,
  ...over,
});

/** A party a player is allowed to create in, which is what most outcome tests need. */
export const openParty = (name = 'Open'): PartyCandidate =>
  party(name, { playerCreationEnabled: true });

export const GM = { id: 'gm1', isGm: true };
export const PLAYER = { id: 'p1', isGm: false };

export const USERS = [
  { id: 'gm1', name: 'Gamemaster', isGm: true },
  { id: 'p1', name: 'Ana', isGm: false },
];

/** Just Ana, for the tests that want creation to happen without a picker in the way. */
export const ONLY_ANA = [USERS[1]!];

export function ports(over: Partial<CreateSheetPorts> = {}): CreateSheetPorts {
  const host = document.createElement('div');
  document.body.append(host);
  return {
    document,
    host: () => host,
    readParties: () => [party('Alpha')],
    readUsers: () => USERS,
    readViewer: () => GM,
    create: vi.fn(async () =>
      Promise.resolve({ kind: 'created' as const, sheet: { uuid: 'Actor.new' } })
    ),
    report: vi.fn(),
    ...over,
  };
}

export const rows = (): HTMLButtonElement[] => [
  ...document.querySelectorAll<HTMLButtonElement>('button[data-choice]'),
];

export const screenText = (): string => document.body.textContent;
