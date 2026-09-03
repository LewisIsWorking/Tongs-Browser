import { beforeEach, describe, expect, it, vi } from 'vitest';

import { beginPartyAccess } from '../../src/ui/PartyAccessFlow.js';
import type { PartyCandidate } from '../../src/foundry/PartyRoster.js';
import { party, ports, rows } from './support/partyAccessPorts.js';

/**
 * What happens when the world changes between the list being drawn and a row being tapped.
 * Written 2026-09-03, split from `partyAccessFlow.test.ts` when that file hit the size limit.
 *
 * ⚠️ These tests are REACHABLE ONLY because the flow reads the party again on tap. The first version
 * searched the array the rows were built from, so the uuid could never miss and the "gone" branch was
 * dead code that no honest test could enter. The tempting fix was `?? parties[0]`, which would have
 * silently changed a permission on the WRONG party rather than saying nothing happened.
 *
 * COVERS: a party deleted under the list, and a party changed by another GM under the list.
 * MISSES: two GMs tapping simultaneously. Last write wins and that is Foundry's answer, not ours.
 */
beforeEach(() => {
  document.body.innerHTML = '';
});

describe('when the world changes under the list', () => {
  it('says the party is gone when it was deleted before the tap', async () => {
    const report = vi.fn();
    let live: PartyCandidate[] = [party('Doomed')];
    beginPartyAccess(ports({ readParties: () => live, report }));

    live = [];
    rows()[0]?.click();

    await vi.waitFor(() => {
      expect(report).toHaveBeenCalled();
    });
    expect(String(report.mock.calls[0]?.[0])).toContain('no longer there');
  });

  /**
   * ⚠️ Acts on the state read NOW, not the stale label. If another GM opened this party a moment ago,
   * the honest response to a tap is to close it, rather than opening something already open because
   * the row said so.
   */
  it('acts on the current state when another GM changed it first', async () => {
    const setAccess = vi.fn(async () => Promise.resolve({ kind: 'set' as const, enabled: false }));
    let live: PartyCandidate[] = [party('Shared')];
    beginPartyAccess(ports({ readParties: () => live, setAccess }));

    live = [party('Shared', { playerCreationEnabled: true })];
    rows()[0]?.click();

    await vi.waitFor(() => {
      expect(setAccess).toHaveBeenCalled();
    });
    expect(setAccess).toHaveBeenCalledWith('Actor.Shared', false);
  });
});
