import { describe, expect, it } from 'vitest';

import { APPLY_OPTIONS } from '../../src/deck/applyOptions.js';
import type { ApplyOption } from '../../src/deck/applyOptions.js';
import { ENTRY_LABEL, applyThroughSystem } from '../../src/deck/applyThroughSystem.js';
import type { ApplyPorts, ContextEntry } from '../../src/deck/applyThroughSystem.js';

/**
 * Applying a card by making PF2e run its own apply, aimed at the roll's target. Written 2026-09-13;
 * aimed rather than selected since 2026-09-15.
 *
 * ⚠️ The fake keeps ONE aim and ONE ordered log, because the contract is about order and about which
 * token PF2e reads at the instant it runs. Counting calls would pass a version that aimed after PF2e had
 * already read its tokens.
 */
const option = (id: ApplyOption['id']): ApplyOption => {
  const found = APPLY_OPTIONS.find((each) => each.id === id);
  if (found === undefined) throw new Error(id);
  return found;
};

interface World {
  ports: ApplyPorts;
  log: string[];
  aimed: { now: readonly object[] | null };
  seenAtClick: (readonly object[] | null)[];
  handled: string[];
}

const world = (
  opts: {
    landed?: boolean;
    targetExists?: boolean;
    entries?: readonly string[];
    triple?: boolean;
    canAim?: boolean;
  } = {}
): World => {
  const log: string[] = [];
  const aimed: World['aimed'] = { now: null };
  const seenAtClick: (readonly object[] | null)[] = [];
  const handled: string[] = [];

  const labels = opts.entries ?? Object.values(ENTRY_LABEL);
  const entries: ContextEntry[] = labels.map((label) => ({
    label,
    onClick: () => {
      seenAtClick.push(aimed.now);
      log.push(`click ${label}`);
    },
  }));

  return {
    log,
    aimed,
    seenAtClick,
    handled,
    ports: {
      contextEntries: () => entries,
      tokenFor: (uuid) => ((opts.targetExists ?? true) ? { uuid } : null),
      canAim: () => opts.canAim ?? true,
      aimAt: (tokens, click) => {
        aimed.now = tokens;
        log.push('aim');
        try {
          click();
        } finally {
          aimed.now = null;
        }
      },
      offersTriple: () => opts.triple ?? true,
      listItemFor: (messageId) => ({ dataset: { messageId } }) as unknown as HTMLElement,
      landed: async () => {
        const armed = log.every((line) => !line.startsWith('click'));
        log.push('watch');
        return Promise.resolve((opts.landed ?? true) && armed);
      },
      markHandled: async (messageId) => {
        handled.push(messageId);
        return Promise.resolve();
      },
    },
  };
};

const request = (id: ApplyOption['id'] = 'full') => ({
  messageId: 'msg1',
  option: option(id),
  targetTokenUuid: 'Scene.S.Token.xorn',
});

describe('aiming at the roll target', () => {
  /** ⛔ PF2e applies to the tokens it reads the instant it runs. Only the target may be there. */
  it('has PF2e reading only the target, on whatever scene, at the moment it runs', async () => {
    const w = world();

    await applyThroughSystem(w.ports, request());

    expect(w.seenAtClick).toEqual([[{ uuid: 'Scene.S.Token.xorn' }]]);
    expect(w.aimed.now).toBeNull();
  });

  it.each(APPLY_OPTIONS.map((each) => [each.id, ENTRY_LABEL[each.id]] as const))(
    'runs PF2e own %s entry',
    async (id, label) => {
      const w = world();

      await applyThroughSystem(w.ports, request(id));

      expect(w.log).toContain(`click ${label}`);
    }
  );
});

describe('confirming it landed', () => {
  /**
   * ⛔ WATCH BEFORE CLICKING. PF2e can post damage-taken before a watcher armed afterwards subscribes.
   * This fake only reports a landing if it was watching first, so a click-then-watch order fails here.
   */
  it('starts watching before it clicks', async () => {
    const w = world();

    const outcome = await applyThroughSystem(w.ports, request());

    expect(w.log.indexOf('watch')).toBeLessThan(
      w.log.findIndex((line) => line.startsWith('click'))
    );
    expect(outcome.kind).toBe('applied');
  });

  it('marks the card handled once it landed', async () => {
    const w = world();

    await applyThroughSystem(w.ports, request());

    expect(w.handled).toEqual(['msg1']);
  });

  /** ⛔ A hit PF2e never confirmed must not disappear from the deck. That would hide a silent failure. */
  it('keeps the card, and says so, when PF2e never confirms', async () => {
    const w = world({ landed: false });

    const outcome = await applyThroughSystem(w.ports, request());

    expect(outcome.kind).toBe('unconfirmed');
    expect(w.handled).toEqual([]);
  });
});

describe('refusing without touching anything', () => {
  it.each([
    ['the target no longer exists', { targetExists: false }, 'full', 'no longer on the scene'],
    [
      'the system offers no such entry',
      { entries: [ENTRY_LABEL.full] },
      'triple',
      'does not offer',
    ],
    /* ⚠️ Triple is hidden unless PF2e crit and fumble buttons are on. The deck follows PF2e, not a list. */
    ['PF2e hides Triple', { triple: false }, 'triple', 'does not offer that option'],
    ['there is no user to aim as', { canAim: false }, 'full', 'no user'],
  ] as const)('refuses when %s', async (_name, opts, id, reason) => {
    const w = world(opts);

    const outcome = await applyThroughSystem(w.ports, request(id));

    expect(outcome).toMatchObject({ kind: 'refused' });
    expect(outcome.kind === 'refused' ? outcome.reason : '').toContain(reason);
    expect(w.log).toEqual([]);
    expect(w.handled).toEqual([]);
  });

  it('still offers Triple when PF2e does', async () => {
    const w = world({ triple: true });
    expect((await applyThroughSystem(w.ports, request('triple'))).kind).toBe('applied');
  });
});
