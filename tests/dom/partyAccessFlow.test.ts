import { beforeEach, describe, expect, it, vi } from 'vitest';

import { beginPartyAccess } from '../../src/ui/PartyAccessFlow.js';
import { party, ports, rows, screenText } from './support/partyAccessPorts.js';

/**
 * A GM opening or closing a party to players. Written 2026-09-03.
 *
 * ⚠️ Two assertions here are about failures that leave no trace at all:
 *
 * - a CLOSED party must still be listed. Filtering to what the viewer may create in would hide
 *   exactly the parties a GM wants to open, and the list would look complete.
 * - the result must be SAID. Changing a permission moves nothing on screen, so silence is
 *   indistinguishable from a tap that missed.
 *
 * COVERS: the listing, the toggle direction, and every way it can fail.
 * MISSES: whether Foundry accepts the flag write. `partyFlag` owns the call, the live harness owns
 *   whether Foundry honours it. Also the races, which live in `partyAccessRace.test.ts`.
 */
beforeEach(() => {
  document.body.innerHTML = '';
});

describe('who may open this list', () => {
  /**
   * ⚠️ Checked here as well as by hiding the button. The button is one way in; a permission enforced
   * only by a control's visibility is not enforced at all.
   */
  it('refuses a player, even though the button is hidden from them', () => {
    beginPartyAccess(ports({ readViewer: () => ({ isGm: false }) }));

    expect(screenText()).toContain('Only a GM can change');
    expect(rows().filter((row) => row.dataset['choice'] !== 'dismiss')).toHaveLength(0);
  });

  it('says there is nothing to open when the world has no parties', () => {
    beginPartyAccess(ports({ readParties: () => [] }));

    expect(screenText()).toContain('Make one first');
  });
});

describe('the list a GM sees', () => {
  /**
   * ⚠️ EVERY party, including closed ones. A closed party is precisely the one a GM came here to
   * open, so filtering to "creatable" would hide the whole point while looking like a complete list.
   */
  it('lists closed parties as well as open ones', () => {
    beginPartyAccess(
      ports({
        readParties: () => [party('Closed'), party('Open', { playerCreationEnabled: true })],
      })
    );

    expect(rows()).toHaveLength(2);
  });

  /** ⚠️ The label carries the CURRENT state, so the list can be read without tapping anything. */
  it('says which parties are already open', () => {
    beginPartyAccess(
      ports({
        readParties: () => [party('Closed'), party('Open', { playerCreationEnabled: true })],
      })
    );

    expect(screenText()).toContain('Closed: closed to players');
    expect(screenText()).toContain('Open: players may add characters');
  });
});

describe('tapping a party', () => {
  it('opens a closed party', async () => {
    const setAccess = vi.fn(async () => Promise.resolve({ kind: 'set' as const, enabled: true }));
    beginPartyAccess(ports({ readParties: () => [party('Closed')], setAccess }));

    rows()[0]?.click();
    await vi.waitFor(() => {
      expect(setAccess).toHaveBeenCalled();
    });

    expect(setAccess).toHaveBeenCalledWith('Actor.Closed', true);
  });

  /**
   * ⚠️ TWO parties in OPPOSITE states, and the second one tapped. Found by mutation on 2026-09-03:
   * replacing the lookup with `readParties()[0]` passed all eleven tests, and passed a first attempt
   * at this test that used two parties in the SAME state.
   *
   * The bug that mutation stands for is subtler than "writes to the wrong party": the uuid written is
   * always the tapped one, so only the DIRECTION and the party NAMED in the confirmation come from
   * the lookup. Reading the wrong party would close an open party by tapping a closed one, and say it
   * had done so to a party the GM never touched. Identical fixtures cannot see any of that.
   *
   * The lookup line was at 100% coverage throughout. Coverage asks whether a line ran, not whether a
   * wrong version of it would be noticed.
   */
  it('takes the direction from the party tapped, not the first in the list', async () => {
    const setAccess = vi.fn(async () => Promise.resolve({ kind: 'set' as const, enabled: false }));
    const report = vi.fn();
    beginPartyAccess(
      ports({
        readParties: () => [party('First'), party('Second', { playerCreationEnabled: true })],
        setAccess,
        report,
      })
    );

    rows()[1]?.click();
    /* ⚠️ Waits for the REPORT, not the write. The report lands a microtask after `setAccess`
     * resolves, so waiting on the write and then reading the report is a race the test loses. */
    await vi.waitFor(() => {
      expect(report).toHaveBeenCalled();
    });

    expect(setAccess).toHaveBeenCalledWith('Actor.Second', false);
    expect(String(report.mock.calls[0]?.[0])).toContain('Second');
  });

  /** ⚠️ Both directions. A switch that only ever turns on is a switch a GM cannot undo. */
  it('closes an open party', async () => {
    const setAccess = vi.fn(async () => Promise.resolve({ kind: 'set' as const, enabled: false }));
    beginPartyAccess(
      ports({ readParties: () => [party('Open', { playerCreationEnabled: true })], setAccess })
    );

    rows()[0]?.click();
    await vi.waitFor(() => {
      expect(setAccess).toHaveBeenCalled();
    });

    expect(setAccess).toHaveBeenCalledWith('Actor.Open', false);
  });

  /**
   * ⚠️ SAID OUT LOUD. Changing a permission moves nothing on screen: no sheet opens, nothing shifts,
   * and the picker has already closed. Silence is indistinguishable from a tap that missed, and the
   * GM would have to reopen the list to find out whether anything happened.
   */
  it('confirms what it did, because nothing visible changes', async () => {
    const report = vi.fn();
    beginPartyAccess(ports({ readParties: () => [party('Closed')], report }));

    rows()[0]?.click();
    await vi.waitFor(() => {
      expect(report).toHaveBeenCalled();
    });

    expect(String(report.mock.calls[0]?.[0])).toContain('may now add characters');
  });

  it('confirms a close in the words of a close', async () => {
    const report = vi.fn();
    beginPartyAccess(
      ports({
        readParties: () => [party('Open', { playerCreationEnabled: true })],
        setAccess: async () => Promise.resolve({ kind: 'set' as const, enabled: false }),
        report,
      })
    );

    rows()[0]?.click();
    await vi.waitFor(() => {
      expect(report).toHaveBeenCalled();
    });

    expect(String(report.mock.calls[0]?.[0])).toContain('closed to players');
  });

  it('reports the reason when the write is refused', async () => {
    const report = vi.fn();
    beginPartyAccess(
      ports({
        readParties: () => [party('Closed')],
        setAccess: async () =>
          Promise.resolve({ kind: 'failed' as const, reason: 'User lacks permission' }),
        report,
      })
    );

    rows()[0]?.click();
    await vi.waitFor(() => {
      expect(report).toHaveBeenCalled();
    });

    expect(String(report.mock.calls[0]?.[0])).toContain('User lacks permission');
  });
});
