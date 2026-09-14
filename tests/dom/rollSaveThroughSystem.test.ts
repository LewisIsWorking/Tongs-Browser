import { describe, expect, it, vi } from 'vitest';

import type { SaveFacts } from '../../src/deck/deckFacts.js';
import { rollSaveThroughSystem } from '../../src/deck/rollSaveThroughSystem.js';
import type { SavePorts } from '../../src/deck/rollSaveThroughSystem.js';

/**
 * Rolling a card's save through PF2e's own control. Written 2026-09-13.
 *
 * ⛔ The ORDER is what these assert, because the order is what the live proof depended on: the card is
 * rendered before the selection is borrowed, the watch is armed before the click, the chosen tokens
 * are the selection AT the click, and the GM's selection is back afterwards, even if the click throws.
 */
const FEAR = '<button data-action="spell-save" data-save="will" data-dc="17">Will</button>';
const TWO_CHECKS = '<a data-pf2-check="athletics">A</a><a data-pf2-check="reflex">R</a>';

const fear: SaveFacts = { statistic: 'will', dc: 17, control: 'spell-save', index: 0 };

interface Harness {
  readonly ports: SavePorts;
  readonly log: string[];
  readonly selected: () => string[];
}

const harness = (html: string, overrides: Partial<SavePorts> = {}): Harness => {
  const log: string[] = [];
  let selection: string[] = ['gm-pick'];
  const token = (name: string) => ({
    control: ({ releaseOthers }: { releaseOthers: boolean }) => {
      selection = releaseOthers ? [name] : [...selection.filter((n) => n !== name), name];
    },
    release: () => {
      selection = selection.filter((n) => n !== name);
    },
  });
  const tokens = new Map(['gm-pick', 'goblin-1', 'goblin-2'].map((n) => [n, token(n)]));
  const ports: SavePorts = {
    controlled: () => selection.map((n) => tokens.get(n)!),
    tokenFor: (uuid) => tokens.get(uuid.replace('Scene.S.Token.', '')) ?? null,
    renderCard: () => {
      log.push('render');
      const card = document.createElement('li');
      card.innerHTML = html;
      return Promise.resolve(card);
    },
    attachHidden: () => {
      log.push('attach');
      return () => log.push('detach');
    },
    click: (control, shiftKey) => {
      log.push(
        `click ${control.textContent} shift=${String(shiftKey)} as [${selection.join(',')}]`
      );
    },
    showsCheckDialogs: () => true,
    savesLanded: () => {
      log.push('watch');
      return Promise.resolve(true);
    },
    markHandled: () => {
      log.push('handled');
      return Promise.resolve();
    },
    ...overrides,
  };
  return { ports, log, selected: () => selection };
};

const goblins = ['Scene.S.Token.goblin-1', 'Scene.S.Token.goblin-2'];

describe('rolling', () => {
  it('renders, watches, clicks as the chosen tokens, then marks the card handled', async () => {
    const { ports, log, selected } = harness(FEAR);

    const outcome = await rollSaveThroughSystem(ports, {
      messageId: 'm',
      save: fear,
      tokenUuids: goblins,
    });

    expect(outcome).toEqual({ kind: 'rolled' });
    expect(log).toEqual([
      'render',
      'attach',
      'watch',
      'click Will shift=true as [goblin-1,goblin-2]',
      'detach',
      'handled',
    ]);
    expect(selected()).toEqual(['gm-pick']);
  });

  /** ⛔ The index counts every inline check, so index 1 is the Reflex link, not the Athletics one. */
  it('clicks the control at the save index', async () => {
    const { ports, log } = harness(TWO_CHECKS);
    const reflex: SaveFacts = { statistic: 'reflex', dc: null, control: 'inline-check', index: 1 };

    await rollSaveThroughSystem(ports, { messageId: 'm', save: reflex, tokenUuids: [goblins[0]!] });

    expect(log.find((line) => line.startsWith('click'))).toContain('click R ');
  });

  it("sets Shift from the GM's own dialog setting", async () => {
    const { ports, log } = harness(FEAR, { showsCheckDialogs: () => false });

    await rollSaveThroughSystem(ports, { messageId: 'm', save: fear, tokenUuids: goblins });

    expect(log.find((line) => line.startsWith('click'))).toContain('shift=false');
  });

  /** ⛔ The GM's selection comes back even when PF2e's handler throws. */
  it('restores the selection and detaches the card when the click throws', async () => {
    const { ports, log, selected } = harness(FEAR, {
      click: () => {
        throw new Error('PF2e broke');
      },
    });

    await expect(
      rollSaveThroughSystem(ports, { messageId: 'm', save: fear, tokenUuids: goblins })
    ).rejects.toThrow('PF2e broke');
    expect(selected()).toEqual(['gm-pick']);
    expect(log).toContain('detach');
  });
});

describe('when PF2e does not confirm', () => {
  it('keeps the card and says so', async () => {
    const { ports, log } = harness(FEAR, { savesLanded: () => Promise.resolve(false) });

    const outcome = await rollSaveThroughSystem(ports, {
      messageId: 'm',
      save: fear,
      tokenUuids: goblins,
    });

    expect(outcome.kind).toBe('unconfirmed');
    expect(log).not.toContain('handled');
  });
});

describe('refusing before anything is clicked', () => {
  const refusedWith = async (harnessed: Harness, tokenUuids: string[], save = fear) => {
    const click = vi.fn();
    const ports = { ...harnessed.ports, click };
    const outcome = await rollSaveThroughSystem(ports, { messageId: 'm', save, tokenUuids });
    expect(click).not.toHaveBeenCalled();
    expect(harnessed.selected()).toEqual(['gm-pick']);
    return outcome.kind === 'refused' ? outcome.reason : `not refused: ${outcome.kind}`;
  };

  it('refuses with nobody chosen', async () => {
    expect(await refusedWith(harness(FEAR), [])).toContain('choose who rolls');
  });

  it('refuses when a chosen token has left the scene', async () => {
    expect(await refusedWith(harness(FEAR), ['Scene.S.Token.gone'])).toContain(
      'no longer on the scene'
    );
  });

  it('refuses when the message is gone', async () => {
    const gone = harness(FEAR, { renderCard: () => Promise.resolve(null) });

    expect(await refusedWith(gone, goblins)).toContain('no longer asks');
  });

  it('refuses when the card no longer has that control', async () => {
    const moved: SaveFacts = { ...fear, index: 3 };

    expect(await refusedWith(harness(FEAR), goblins, moved)).toContain('no longer asks');
  });
});
