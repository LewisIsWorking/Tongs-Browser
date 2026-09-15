import { afterEach, describe, expect, it, vi } from 'vitest';

import { MANUAL_CAUSE, MAX_CAUSE_LENGTH, describeCause } from '../../src/bands/bandCause.js';
import { readCauseFacts, readIwr, watchCause } from '../../src/bands/causeWatch.js';
import type { CauseHooks, DamageTakenMessage } from '../../src/bands/causeWatch.js';

/**
 * Why an HP change happened, read from PF2e's damage-taken card, shaped like pf2e 8.5.0's `applyDamage`.
 * Written 2026-09-15.
 */
afterEach(() => {
  vi.useRealTimers();
});

const card = (overrides: Record<string, unknown> = {}, content = ''): DamageTakenMessage => ({
  flags: {
    pf2e: {
      context: { type: 'damage-taken' },
      appliedDamage: { uuid: 'Scene.S.Token.X.Actor.A', isHealing: false },
      origin: { uuid: 'Actor.L.Item.S', actor: 'Actor.L' },
      ...overrides,
    },
  },
  content,
});
const NAMES: Record<string, string> = { 'Actor.L.Item.S': 'Longsword', 'Actor.L': 'Lai' };
const nameOf = (uuid: string) => NAMES[uuid] ?? null;
const IWR =
  '<span class="iwr" data-applications="[{&quot;category&quot;:&quot;resistance&quot;,&quot;type&quot;:&quot;fire&quot;,&quot;adjustment&quot;:-5},{&quot;category&quot;:&quot;weakness&quot;,&quot;type&quot;:&quot;cold-iron&quot;,&quot;adjustment&quot;:3}]"></span>';

describe('describing a cause', () => {
  it('names the item, who used it, and the IWR applied', () => {
    expect(describeCause(readCauseFacts(card({}, IWR), 'pf2e', nameOf))).toBe(
      'Longsword from Lai; resistance fire -5, weakness cold-iron +3'
    );
    expect(describeCause({ itemName: null, actorName: 'Lai', healing: false, iwr: [] })).toBe(
      'Lai'
    );
    expect(describeCause({ itemName: null, actorName: null, healing: false, iwr: [] })).toBe(
      'damage applied'
    );
  });

  it('says healing is healing, and a change nothing in PF2e explains is a manual change', () => {
    expect(describeCause({ itemName: 'Heal', actorName: 'Kyra', healing: true, iwr: [] })).toBe(
      'healed by Heal from Kyra'
    );
    expect(describeCause({ itemName: null, actorName: null, healing: true, iwr: [] })).toBe(
      'healing applied'
    );
    expect(describeCause(null)).toBe(MANUAL_CAUSE);
  });

  it('stays within what COO accepts', () => {
    const long = describeCause({
      itemName: 'x'.repeat(300),
      actorName: null,
      healing: false,
      iwr: [],
    });
    expect(long).toHaveLength(MAX_CAUSE_LENGTH);
    expect(long.endsWith('...')).toBe(true);
  });

  it('reads no IWR from a card without it, with broken JSON, or with entries of the wrong shape', () => {
    expect(readIwr('<span class="statements">takes 5 damage</span>')).toEqual([]);
    expect(readIwr('data-applications="[oops"')).toEqual([]);
    expect(readIwr('data-applications="{&quot;a&quot;:1}"')).toEqual([]);
    expect(readIwr('data-applications="[{&quot;category&quot;:&quot;x&quot;},7]"')).toEqual([]);
    expect(
      readIwr(
        'data-applications="[{&quot;category&quot;:&quot;&amp;&lt;&gt;&#39;&quot;,&quot;type&quot;:&quot;t&quot;,&quot;adjustment&quot;:1}]"'
      )
    ).toEqual([{ category: "&<>'", type: 't', adjustment: 1 }]);
    expect(readCauseFacts({}, 'pf2e', nameOf)).toEqual({
      itemName: null,
      actorName: null,
      healing: false,
      iwr: [],
    });
  });
});

describe('waiting for the card', () => {
  const hooks = () => {
    const handlers = new Map<number, (message: DamageTakenMessage) => void>();
    const fake: CauseHooks & { handlers: typeof handlers } = {
      handlers,
      on(this: unknown, _name: string, fn: (...args: never[]) => unknown) {
        handlers.set(handlers.size + 1, fn as (message: DamageTakenMessage) => void);
        return handlers.size;
      },
      off(this: unknown, _name: string, id: number) {
        handlers.delete(id);
      },
    };
    const send = (message: DamageTakenMessage) => {
      for (const fn of [...handlers.values()]) fn(message);
    };
    return { fake, send };
  };

  it("takes the card for this actor, ignoring other actors' and other cards", async () => {
    const { fake, send } = hooks();
    const waiting = watchCause(fake, 'pf2e', 'Scene.S.Token.X.Actor.A', 3000, nameOf);

    send(card({ appliedDamage: { uuid: 'Actor.Other' } }));
    send({ flags: { pf2e: { context: { type: 'damage-roll' } } } });
    send(card({}, IWR));

    expect(await waiting).toBe('Longsword from Lai; resistance fire -5, weakness cold-iron +3');
    expect(fake.handlers.size).toBe(0);
  });

  it('calls it a manual change when no card comes, and stops listening', async () => {
    vi.useFakeTimers();
    const { fake, send } = hooks();
    const waiting = watchCause(fake, 'pf2e', 'Scene.S.Token.X.Actor.A', 3000, nameOf);

    vi.advanceTimersByTime(3000);
    send(card());

    expect(await waiting).toBe(MANUAL_CAUSE);
    expect(fake.handlers.size).toBe(0);
  });
});
