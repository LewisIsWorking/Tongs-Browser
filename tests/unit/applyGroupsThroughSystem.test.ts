import { describe, expect, it } from 'vitest';

import { APPLY_OPTIONS } from '../../src/deck/applyOptions.js';
import type { ApplyOption } from '../../src/deck/applyOptions.js';
import { ENTRY_LABEL, applyGroupsThroughSystem } from '../../src/deck/applyThroughSystem.js';
import type { ApplyPorts, ContextEntry } from '../../src/deck/applyThroughSystem.js';

/**
 * One card applied to several targets in several ways, marked handled once. Written 2026-09-14 for
 * basic saves. Single-target applying is in `applyThroughSystem.test.ts`.
 *
 * ⚠️ Like that file's fake, this keeps ONE aim and ONE ordered log: the contract is which tokens PF2e
 * reads at the instant it runs, and that every watch is armed before its click.
 */
const option = (id: ApplyOption['id']): ApplyOption => {
  const found = APPLY_OPTIONS.find((each) => each.id === id);
  if (found === undefined) throw new Error(id);
  return found;
};

const world = (
  opts: {
    neverLands?: readonly string[];
    noTriple?: boolean;
    gone?: readonly string[];
    entries?: readonly string[];
  } = {}
) => {
  const log: string[] = [];
  let aimed: string[] = [];
  const handled: string[] = [];
  const entries: ContextEntry[] = (opts.entries ?? Object.values(ENTRY_LABEL)).map((label) => ({
    label,
    onClick: () => {
      log.push(`click ${label} with ${[...aimed].sort().join(',')}`);
    },
  }));
  const ports: ApplyPorts = {
    contextEntries: () => entries,
    tokenFor: (uuid) => ((opts.gone ?? []).includes(uuid) ? null : { uuid }),
    canAim: () => true,
    aimAt: (tokens, click) => {
      aimed = tokens.map((token) => (token as { uuid: string }).uuid);
      try {
        click();
      } finally {
        aimed = [];
      }
    },
    offersTriple: () => opts.noTriple !== true,
    listItemFor: (messageId) => ({ dataset: { messageId } }) as unknown as HTMLElement,
    landed: async (uuid) => {
      log.push(`watch ${uuid}`);
      return Promise.resolve(!(opts.neverLands ?? []).includes(uuid));
    },
    markHandled: async (messageId) => {
      handled.push(messageId);
      return Promise.resolve();
    },
  };
  return { ports, log, handled, aimedNow: () => aimed };
};

const HALF = ENTRY_LABEL.half;
const DOUBLE = ENTRY_LABEL.double;
const groups = [
  { option: option('half'), targetTokenUuids: ['x1', 'x2'] },
  { option: option('double'), targetTokenUuids: ['x3'] },
];

describe('applying one card by groups', () => {
  it('aims PF2e at exactly each group as it runs, watches first, and marks the card once', async () => {
    const w = world();

    const outcome = await applyGroupsThroughSystem(w.ports, { messageId: 'd1', groups });

    expect(outcome).toEqual({ kind: 'applied' });
    expect(w.log).toEqual([
      'watch x1',
      'watch x2',
      `click ${HALF} with x1,x2`,
      'watch x3',
      `click ${DOUBLE} with x3`,
    ]);
    expect(w.handled).toEqual(['d1']);
    expect(w.aimedNow()).toEqual([]);
  });

  it('marks a card nobody takes damage from handled, sending nothing', async () => {
    const w = world();

    expect(await applyGroupsThroughSystem(w.ports, { messageId: 'd1', groups: [] })).toEqual({
      kind: 'applied',
    });
    expect(w.log).toEqual([]);
    expect(w.handled).toEqual(['d1']);
  });

  it('refuses before the first click when any group cannot be sent', async () => {
    for (const [opts, request] of [
      [{ gone: ['x3'] }, groups],
      [{ entries: [HALF] }, groups],
      [{}, [{ option: option('full'), targetTokenUuids: [] }]],
      [{ noTriple: true }, [...groups, { option: option('triple'), targetTokenUuids: ['x4'] }]],
    ] as const) {
      const w = world(opts);
      const outcome = await applyGroupsThroughSystem(w.ports, { messageId: 'd1', groups: request });
      expect(outcome.kind).toBe('refused');
      expect(w.log).toEqual([]);
      expect(w.handled).toEqual([]);
    }
  });

  it('keeps the card, saying part landed, when a later group fails', async () => {
    const neverLands = world({ neverLands: ['x3'] });
    const late = await applyGroupsThroughSystem(neverLands.ports, { messageId: 'd1', groups });
    expect(late).toEqual({
      kind: 'unconfirmed',
      reason: expect.stringContaining('some of the damage'),
    });
    expect(neverLands.handled).toEqual([]);
  });

  it('reports the first group failing the way a single apply does', async () => {
    const w = world({ neverLands: ['x2'] });

    const outcome = await applyGroupsThroughSystem(w.ports, { messageId: 'd1', groups });

    expect(outcome).toEqual({
      kind: 'unconfirmed',
      reason: 'PF2e never reported the damage landing, so the card was kept',
    });
    expect(w.log.some((line) => line.includes(DOUBLE))).toBe(false);
  });
});
