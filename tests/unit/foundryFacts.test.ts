import { describe, expect, it, vi } from 'vitest';

import { readFoundryFacts, type FoundryGlobals } from '../../src/debug/FoundryFacts.js';

/**
 * Everything the diagnostics report reads out of Foundry.
 *
 * These assertions are about HONESTY rather than plumbing: every field here is read by somebody
 * trying to work out why a drag failed on a phone they cannot see, so a field that guesses is worse
 * than one that admits it does not know.
 */
const MODULE_ID = 'tongs-browser';

const globals = (overrides: Partial<FoundryGlobals> = {}): FoundryGlobals => ({
  game: {
    user: { id: 'u1', isGM: true },
    paused: false,
    activeTool: 'select',
    modules: { get: () => ({ version: '0.25.13' }) },
  },
  canvas: {
    ready: true,
    mousePosition: { x: 10, y: 20 },
    tokens: { controlled: [{ name: 'Goblin', document: { x: 1, y: 2 }, w: 50, h: 50 }] },
  },
  ...overrides,
});

describe('readFoundryFacts', () => {
  /**
   * ⚠️ Null, not a blank report. A report full of "unknown" looks like a measurement that came back
   * empty; it actually means the button was pressed before the world finished loading, which is a
   * different thing for the reader to do about it.
   */
  it('returns nothing at all when there is no game yet', () => {
    expect(readFoundryFacts({}, MODULE_ID)).toBeNull();
    expect(readFoundryFacts({ canvas: { ready: true } }, MODULE_ID)).toBeNull();
  });

  it('reads the whole state in one pass', () => {
    const facts = readFoundryFacts(globals(), MODULE_ID);

    expect(facts).toMatchObject({
      userId: 'u1',
      isGm: true,
      paused: false,
      activeTool: 'select',
      manifestVersion: '0.25.13',
      canvasReady: 'true',
      mouse: { x: 10, y: 20 },
    });
    expect(facts?.selected?.name).toBe('Goblin');
  });

  /**
   * ⚠️ The build stamp says what was COMPILED. This says what Foundry actually LOADED, and the two
   * disagreeing is the "am I even running the version you think I am" question that cost a full round
   * trip when a device reported against a stale copy.
   */
  it('reports the version Foundry loaded, and says so when it cannot', () => {
    expect(readFoundryFacts(globals(), MODULE_ID)?.manifestVersion).toBe('0.25.13');

    const noModules = globals({ game: { user: {}, modules: undefined } });
    expect(readFoundryFacts(noModules, MODULE_ID)?.manifestVersion).toBe('unknown');

    const noEntry = globals({ game: { user: {}, modules: { get: () => undefined } } });
    expect(readFoundryFacts(noEntry, MODULE_ID)?.manifestVersion).toBe('unknown');
  });

  it('asks Foundry for the module by id, not by guessing', () => {
    const get = vi.fn(() => ({ version: '1.0.0' }));

    readFoundryFacts(globals({ game: { user: {}, modules: { get } } }), MODULE_ID);

    expect(get).toHaveBeenCalledWith(MODULE_ID);
  });

  describe('canDrag', () => {
    /**
     * Foundry's own permission answer, not ours. If this says false the drag was never going to work
     * and nothing else in the report matters, so guessing would be worse than admitting 'n/a'.
     */
    it("reports Foundry's answer, passing it the user it is asking about", () => {
      const canDrag = vi.fn(() => false);
      const state = globals({
        game: { user: { id: 'u1' }, modules: { get: () => undefined } },
        canvas: { tokens: { controlled: [{ _canDrag: canDrag }] } },
      });

      expect(readFoundryFacts(state, MODULE_ID)?.canDrag).toBe('false');
      expect(canDrag).toHaveBeenCalledWith({ id: 'u1' });
    });

    it('admits n/a rather than guessing when the check is not there', () => {
      expect(readFoundryFacts(globals(), MODULE_ID)?.canDrag).toBe('n/a');
    });
  });

  it('survives a world with a game and nothing else', () => {
    const facts = readFoundryFacts({ game: {} }, MODULE_ID);

    expect(facts).toMatchObject({
      userId: undefined,
      isGm: false,
      paused: false,
      canvasReady: 'undefined',
      canDrag: 'n/a',
      manifestVersion: 'unknown',
    });
    expect(facts?.selected).toBeUndefined();
  });

  it('treats an empty selection the same as no selection', () => {
    const state = globals({ canvas: { tokens: { controlled: [] } } });

    expect(readFoundryFacts(state, MODULE_ID)?.selected).toBeUndefined();
  });

  it('reports GM and paused as booleans rather than whatever Foundry stored', () => {
    const state = globals({ game: { user: { isGM: 'yes' }, paused: 1 } });
    const facts = readFoundryFacts(state, MODULE_ID);

    expect(facts?.isGm).toBe(false);
    expect(facts?.paused).toBe(false);
  });
});
