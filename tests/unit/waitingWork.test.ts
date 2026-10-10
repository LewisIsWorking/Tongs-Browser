import { describe, expect, it } from 'vitest';

import { waitingWork } from '../../src/helper/waitingWork.js';
import type { WaitingGame } from '../../src/helper/waitingWork.js';

/** What COO's helper GM reports: the queued work, in words, and only to a GM. 2026-10-10. */
const flagged =
  (flags: Record<string, unknown>) =>
  (scope: string, key: string): unknown =>
    scope === 'tongs-browser' ? flags[key] : undefined;

const message = (id: string, author: string, flags: Record<string, unknown>, visible = true) => ({
  id,
  timestamp: 1,
  visible,
  author: { id, name: author },
  flags: { 'tongs-browser': flags },
});

const game = (isGM: boolean): WaitingGame => ({
  user: { id: 'gm', isGM },
  users: {
    contents: [
      {
        id: 'u1',
        name: 'Terra',
        getFlag: flagged({ sheetRequest: { id: 'r', name: 'Lai', at: 1 } }),
      },
      { id: 'u2', name: 'Kai', getFlag: flagged({}) },
    ],
  },
  messages: {
    contents: [
      message('m1', 'Kai', { pending: true }),
      message('m2', 'Oscar', { pending: true, targets: ['Token.x'] }),
      message('m3', 'Kai', { pending: false }),
      message('m4', 'Hidden', { pending: true }, false),
    ],
  },
});

describe('the waiting work', () => {
  it('names each sheet request and queued card for a GM', () => {
    expect(waitingWork(game(true))).toEqual([
      `Terra's character sheet "Lai"`,
      "Kai's damage",
      "Oscar's spell saves",
    ]);
  });

  it('is empty in a player browser, which may not see these', () => {
    expect(waitingWork(game(false))).toEqual([]);
    expect(waitingWork(undefined)).toEqual([]);
  });
});
