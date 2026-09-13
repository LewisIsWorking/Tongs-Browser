import { describe, expect, it } from 'vitest';

import { APPLY_OPTIONS } from '../../src/deck/applyOptions.js';
import type { ApplyOption } from '../../src/deck/applyOptions.js';
import { ENTRY_LABEL, applyThroughSystem } from '../../src/deck/applyThroughSystem.js';
import type { ApplyPorts, ContextEntry, TokenLike } from '../../src/deck/applyThroughSystem.js';

/**
 * Applying a card by making PF2e run its own apply, aimed at the roll's target. Written 2026-09-13.
 *
 * ⚠️ The fake keeps ONE selection set and ONE ordered log, because the contract is about order and about
 * which token is selected at the instant PF2e reads the selection. Counting calls would pass a version
 * that selected the target after PF2e had already read the old selection.
 */
const option = (id: ApplyOption['id']): ApplyOption => {
  const found = APPLY_OPTIONS.find((each) => each.id === id);
  if (found === undefined) throw new Error(id);
  return found;
};

interface World {
  ports: ApplyPorts;
  log: string[];
  selected: Set<string>;
  seenAtClick: string[];
  handled: string[];
}

const world = (
  opts: {
    landed?: boolean;
    visible?: boolean;
    targetExists?: boolean;
    entries?: string[];
    initial?: string[];
  } = {}
): World => {
  const log: string[] = [];
  const selected = new Set<string>(opts.initial ?? ['mine']);
  const seenAtClick: string[] = [];
  const handled: string[] = [];
  let armed = false;

  const token = (id: string): TokenLike => ({
    control: ({ releaseOthers }) => {
      if (releaseOthers) selected.clear();
      selected.add(id);
      log.push(`control ${id}`);
    },
    release: () => {
      selected.delete(id);
      log.push(`release ${id}`);
    },
  });

  const labels = opts.entries ?? Object.values(ENTRY_LABEL);
  const entries: ContextEntry[] = labels.map((label) => ({
    label,
    visible: () => opts.visible ?? true,
    onClick: () => {
      seenAtClick.push(...selected);
      log.push(`click ${label}`);
    },
  }));

  return {
    log,
    selected,
    seenAtClick,
    handled,
    ports: {
      contextEntries: () => entries,
      controlled: () => [...selected].map(token),
      tokenFor: (uuid) => ((opts.targetExists ?? true) ? token(uuid) : null),
      listItemFor: (messageId) => ({ dataset: { messageId } }) as unknown as HTMLElement,
      landed: async () => {
        armed = log.every((line) => !line.startsWith('click'));
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
  /** ⛔ PF2e applies to the CONTROLLED tokens, read the instant it runs. Only the target may be there. */
  it('has only the target selected at the moment PF2e runs', async () => {
    const w = world();

    await applyThroughSystem(w.ports, request());

    expect(w.seenAtClick).toEqual(['Scene.S.Token.xorn']);
  });

  it('puts the GM own selection back afterwards', async () => {
    const w = world({ initial: ['mine', 'also-mine'] });

    await applyThroughSystem(w.ports, request());

    expect([...w.selected].sort()).toEqual(['also-mine', 'mine']);
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
  it('refuses when the target is no longer on the scene', async () => {
    const w = world({ targetExists: false });

    const outcome = await applyThroughSystem(w.ports, request());

    expect(outcome.kind).toBe('refused');
    expect(w.log.some((line) => line.startsWith('click'))).toBe(false);
    expect([...w.selected]).toEqual(['mine']);
  });

  it('refuses when the system offers no such entry', async () => {
    const w = world({ entries: [ENTRY_LABEL.full] });

    const outcome = await applyThroughSystem(w.ports, request('triple'));

    expect(outcome.kind).toBe('refused');
    expect(w.handled).toEqual([]);
  });

  /** ⚠️ Triple is hidden unless PF2e crit and fumble buttons are on. The deck follows PF2e, not a list. */
  it('refuses, and restores the selection, when PF2e hides the option', async () => {
    const w = world({ visible: false });

    const outcome = await applyThroughSystem(w.ports, request('triple'));

    expect(outcome.kind).toBe('refused');
    expect(w.log.some((line) => line.startsWith('click'))).toBe(false);
    expect([...w.selected]).toEqual(['mine']);
  });
});
