import { beforeEach, describe, expect, it, vi } from 'vitest';

import { beginCreateSheet } from '../../src/ui/CreateSheetFlow.js';
import { ONLY_ANA, PLAYER, openParty, ports } from './support/createSheetPorts.js';

/**
 * What the user is left with once the create has run. Written 2026-09-02.
 *
 * ⚠️ ALL THREE OUTCOMES ARE REPORTED, and that is the whole content of this file. A create that
 * quietly did nothing is the worst of the three, because the user's only recourse is to tap again,
 * and on the one path where the sheet DOES exist that produces a duplicate.
 *
 * Split from `createSheetFlow.test.ts` when it crossed the 200 line limit; that file owns getting to
 * the decision, this one owns living with the result.
 */
const playerCreating = (over = {}) =>
  ports({
    readParties: () => [openParty()],
    readUsers: () => ONLY_ANA,
    readViewer: () => PLAYER,
    ...over,
  });

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('what happens after creating', () => {
  /** Opening it is the point: the default name is meant to be changed in Foundry's own sheet. */
  it('opens the sheet it just made', async () => {
    const render = vi.fn();
    const create = vi.fn(async () =>
      Promise.resolve({ kind: 'created' as const, sheet: { sheet: { render } } })
    );
    beginCreateSheet(playerCreating({ create }));

    await vi.waitFor(() => {
      expect(render).toHaveBeenCalledWith(true);
    });
  });

  /**
   * ⚠️ The sheet EXISTS, so it is opened AND explained. Leading with the failure would invite a
   * second attempt and a second sheet, when the fix is to drag this one into the party.
   */
  it('opens the sheet and says so when the party join failed', async () => {
    const render = vi.fn();
    const report = vi.fn();
    const create = vi.fn(async () =>
      Promise.resolve({
        kind: 'createdOutsideParty' as const,
        sheet: { sheet: { render } },
        reason: 'party is locked',
      })
    );
    beginCreateSheet(playerCreating({ create, report }));

    await vi.waitFor(() => {
      expect(report).toHaveBeenCalled();
    });
    expect(render).toHaveBeenCalledWith(true);
    expect(String(report.mock.calls[0]?.[0])).toContain('party is locked');
  });

  /** ⚠️ The REASON travels to the user. A phone has no console to read it from instead. */
  it('reports a failure with its reason', async () => {
    const report = vi.fn();
    const create = vi.fn(async () =>
      Promise.resolve({ kind: 'notCreated' as const, reason: 'no permission' })
    );
    beginCreateSheet(playerCreating({ create, report }));

    await vi.waitFor(() => {
      expect(report).toHaveBeenCalled();
    });
    expect(String(report.mock.calls[0]?.[0])).toContain('no permission');
  });

  it('says the character could not be created, not merely why', async () => {
    const report = vi.fn();
    const create = vi.fn(async () =>
      Promise.resolve({ kind: 'notCreated' as const, reason: 'no permission' })
    );
    beginCreateSheet(playerCreating({ create, report }));

    await vi.waitFor(() => {
      expect(report).toHaveBeenCalled();
    });
    expect(String(report.mock.calls[0]?.[0])).toContain('could not be created');
  });
});
