import { describe, expect, it, vi } from 'vitest';

import { buildSpellSavePorts } from '../../src/automation/startSpellSaves.js';
import type { RollDeck } from '../../src/deck/RollDeck.js';

/**
 * Reading and rolling a cast card's save, against the measured Daze card. Written 2026-09-14.
 *
 * ⚠️ In the DOM project because the save button is read out of the card's stored HTML.
 */
const DAZE =
  '<button type="button" data-action="spell-save" data-save="will" data-dc="21">Will</button>';

describe('the spell-save ports', () => {
  it("reads the spell's own save button from the card", () => {
    const ports = buildSpellSavePorts({}, {} as RollDeck, document);

    expect(ports.saveControls({ id: 'c', timestamp: 1, content: DAZE })).toEqual([
      { statistic: 'will', dc: 21, control: 'spell-save', index: 0 },
    ]);
    expect(ports.saveControls({ id: 'c', timestamp: 1 })).toEqual([]);
    expect(ports.moduleId).toBe('tongs-browser');
  });

  it("rolls through the roll deck's own save path, on the deck", async () => {
    const deck = {
      calls: [] as unknown[],
      async rollSave(this: { calls: unknown[] }, ...args: unknown[]) {
        this.calls.push(args);
        return Promise.resolve({ kind: 'rolled' as const });
      },
    };
    const ports = buildSpellSavePorts({}, deck as unknown as RollDeck, document);

    await expect(ports.rollSave('c', 0, ['Scene.S.Token.X'])).resolves.toEqual({ kind: 'rolled' });
    expect(deck.calls).toEqual([['c', 0, ['Scene.S.Token.X']]]);
    expect(vi.isMockFunction(ports.rollSave)).toBe(false);
  });
});
