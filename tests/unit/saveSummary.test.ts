import { describe, expect, it, vi } from 'vitest';

import { SaveSummary } from '../../src/automation/SaveSummary.js';
import type { SaveSummaryPorts } from '../../src/automation/SaveSummary.js';
import type { SummaryFlags } from '../../src/automation/saveSummaryCard.js';
import type { SpellMessage } from '../../src/automation/spellDamageFacts.js';
import { cast, damageCard, harness, X1, X2 } from './support/spellDamageWorld.js';

/**
 * The saves card, posted by the GM's browser once a cast's saves are in, then completed by its damage.
 * Written 2026-10-07 for Lewis: the saves are GM-only, so this card is how the table learns how they went.
 */
const caster: SpellMessage = { ...cast, author: { id: 'player' } };
const save = (id: string, token: string, outcome: string, castId: string | null = 'c1') => ({
  id,
  timestamp: 1_500,
  flags: {
    pf2e: {
      context: { type: 'saving-throw', outcome, target: { token } },
      origin: { uuid: 'Actor.Caster.Item.Feast' },
    },
    ...(castId === null ? {} : { 'tongs-browser': { forCast: castId } }),
  },
});

const world = (overrides: Partial<SaveSummaryPorts> = {}) => {
  const messages: SpellMessage[] = [caster];
  const posted: { content: string; flags: SummaryFlags }[] = [];
  const edits: { id: string; content: string; flags: SummaryFlags }[] = [];
  const ports: SaveSummaryPorts = {
    role: () => 'act',
    systemId: () => 'pf2e',
    moduleId: 'tongs-browser',
    recentMessages: () => messages,
    castMessage: (id) => messages.find((each) => each.id === id) ?? null,
    spellName: () => 'Vampiric Feast',
    target: (token) => ({
      name: token === X1 ? 'Kreski' : 'The creature',
      band: { segments: 2, word: 'Staggering' },
    }),
    post: async (content, flags) => {
      await new Promise((resolve) => setTimeout(resolve, 2));
      posted.push({ content, flags });
      messages.push({
        id: `card${String(posted.length)}`,
        timestamp: 9,
        flags: { 'tongs-browser': { saveSummary: flags } },
      });
    },
    edit: (id, content, flags) => {
      edits.push({ id, content, flags });
      const at = messages.findIndex((each) => each.id === id);
      messages[at] = { id, timestamp: 9, flags: { 'tongs-browser': { saveSummary: flags } } };
      return Promise.resolve();
    },
    ...overrides,
  };
  const land = async (message: SpellMessage) => {
    messages.push(message);
    await summary.onSaveCreated(message);
  };
  const summary = new SaveSummary(ports);
  return { summary, messages, posted, edits, land };
};

describe('the saves card', () => {
  it('waits for every target, then posts ONE card in words, for the caster', async () => {
    const { summary, messages, posted, land } = world();
    await land(save('s1', X1, 'success'));
    expect(posted).toEqual([]);

    const s2 = save('s2', X2, 'criticalFailure');
    messages.push(s2);
    await Promise.all([summary.onSaveCreated(s2), summary.onSaveCreated(s2)]);

    expect(posted).toHaveLength(1);
    expect(posted[0]?.content).toContain('Kreski: Success</li><li>The creature: Critical failure');
    expect(posted[0]?.content).not.toMatch(/\d/);
    expect(posted[0]?.flags).toMatchObject({ castId: 'c1', casterUserId: 'player', taken: null });
  });

  it('completes the same card with the damage and the bands, and keeps them on a later rewrite', async () => {
    const { summary, posted, edits, land } = world();
    await land(save('s1', X1, 'success'));
    await land(save('s2', X2, 'criticalSuccess'));

    await summary.onDamageApplied('c1', [X1, X2], [{ optionId: 'half', targetTokenUuids: [X1] }]);
    await summary.onSaveCreated(save('s1', X1, 'success'));

    expect(posted).toHaveLength(1);
    expect(edits.map((each) => each.id)).toEqual(['card1', 'card1']);
    for (const edit of edits) {
      expect(edit.content).toContain('Kreski: Success, half damage. ▰▰▱▱▱▱▱▱▱▱ Staggering');
      expect(edit.content).toContain('The creature: Critical success, no damage');
      expect(edit.flags.taken).toEqual({ [X1]: 'half', [X2]: 'none' });
    }
  });

  it('posts for a cast with no author, and carries on after a card Foundry refused', async () => {
    let refuse = true;
    const { posted, land } = world({
      castMessage: () => cast,
      post: (content, flags) => {
        if (refuse) {
          refuse = false;
          return Promise.reject(new Error('no chat'));
        }
        posted.push({ content, flags });
        return Promise.resolve();
      },
    });
    await land(save('s1', X1, 'success'));
    await expect(land(save('s2', X2, 'success'))).rejects.toThrow('no chat');
    await land(save('s2', X2, 'failure'));

    expect(posted).toHaveLength(1);
    expect(posted[0]?.flags.casterUserId).toBeNull();
  });

  it('posts nothing for a save Tongs did not roll, a browser that is not acting, or a lost cast', async () => {
    const untagged = world();
    await untagged.land(save('s1', X1, 'success', null));
    await untagged.land(save('s2', X2, 'success', null));
    const leaving = world({ role: () => 'leave' });
    await leaving.land(save('s1', X1, 'success'));
    const lost = world();
    await lost.summary.onDamageApplied('gone', [X1], []);
    const notCast = world({ castMessage: () => damageCard });
    await notCast.summary.onDamageApplied('d1', [X1], []);
    const untargeted = world({
      castMessage: () => ({ ...cast, flags: { ...cast.flags, 'tongs-browser': {} } }),
    });
    await untargeted.summary.onDamageApplied('c1', [], []);

    for (const each of [untagged, leaving, lost, notCast, untargeted]) {
      expect(each.posted).toEqual([]);
    }
  });
});

describe('spell damage tells the card', () => {
  it('names the cast whose saves were rolled, with the groups it applied', async () => {
    const onApplied = vi.fn(() => Promise.resolve());
    const { damage } = harness({ onApplied });

    await damage.onMessageCreated(damageCard);

    expect(onApplied).toHaveBeenCalledWith(
      'c1',
      [X1, X2],
      [
        { optionId: 'half', targetTokenUuids: [X1] },
        { optionId: 'full', targetTokenUuids: [X2] },
      ]
    );
  });
});
