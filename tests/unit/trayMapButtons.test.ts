import { describe, expect, it, vi } from 'vitest';

import { actionIds, findAction } from './support/trayHandlers.js';

/**
 * The GM map-building cluster on the control pad. Written 2026-09-09.
 *
 * ⚠️ Its own file rather than more of `trayGatedButtons`, which is at 85 lines and owns the two
 * sheet-related gates. This owns one cluster of six, and keeping them apart is what stops either file
 * growing into the thing the size rule then forces someone to split under time pressure.
 *
 * ⛔ WHAT THESE CLOSE. `scripts/keybindings/coverage.ts` recorded nineteen Foundry keybindings a
 * phone could not reach. Most were honest non-gaps: diagonal pans compose, token movement is what
 * dragging is for. These six were the residue a user genuinely could not do at all: a GM building a
 * map on a phone could not select, cut, copy, paste or restack anything.
 */
const MAP_BUTTONS = ['select-all', 'cut', 'copy', 'paste', 'send-to-back', 'bring-to-front'];

describe('the map-building buttons', () => {
  it.each(MAP_BUTTONS)('offers %s to a GM', (id) => {
    expect(actionIds({ canBuildMaps: () => true })).toContain(id);
  });

  /**
   * ⛔ ABSENT, not disabled, and permanently so rather than "until something lands". Foundry refuses
   * these operations to anyone who is not a GM, so a button offered to a player could only ever be
   * silence, and silence on a phone reads as a broken module, because there is no console to check.
   */
  it.each(MAP_BUTTONS)('does not offer %s to a player at all', (id) => {
    expect(actionIds({ canBuildMaps: () => false })).not.toContain(id);
  });

  /** ⚠️ One capability: the gate takes all six or none, never a usable half of a clipboard. */
  it('hides all six together rather than a subset', () => {
    const player = actionIds({ canBuildMaps: () => false });

    expect(MAP_BUTTONS.filter((id) => player.includes(id))).toEqual([]);
    expect(player.length).toBe(actionIds({ canBuildMaps: () => true }).length - MAP_BUTTONS.length);
  });

  /** ⚠️ Hiding the cluster must not take the ordinary controls with it. */
  it('leaves the buttons every user needs in place', () => {
    const player = actionIds({ canBuildMaps: () => false });

    expect(player).toContain('character');
    expect(player).toContain('sidebar');
    expect(player).toContain('grab');
    expect(player).toContain('undo');
  });

  /**
   * ⚠️ Independent of the other two gates, asserted rather than assumed. All three are GM-only today,
   * which is exactly the condition under which one flag quietly starts serving all three.
   */
  it('is unaffected by the sheet gates, and does not affect them', () => {
    const noCreate = actionIds({ canCreateSheets: () => false });
    expect(noCreate).toContain('cut');

    const noMaps = actionIds({ canBuildMaps: () => false });
    expect(noMaps).toContain('create-sheet');
    expect(noMaps).toContain('party-access');
  });
});

describe('what the map-building buttons do when tapped', () => {
  it.each([
    ['select-all', 'selectAll'],
    ['cut', 'cut'],
    ['copy', 'copy'],
    ['paste', 'paste'],
    ['send-to-back', 'sendToBack'],
    ['bring-to-front', 'bringToFront'],
  ] as const)('runs the %s handler', (id, handler) => {
    const spy = vi.fn();

    findAction({ [handler]: spy }, id).activate();

    expect(spy).toHaveBeenCalledOnce();
  });
});

describe('how the map-building buttons read', () => {
  /**
   * ⛔ WORDS, NOT GLYPHS, asserted so it survives a tidy-up. There is no glyph anybody agrees means
   * "send to back", and the near misses (⤓ ⧉ ⬚) are the characters a phone font is most likely to
   * render as a tofu box. A button labelled □ is a dead control: it cannot be guessed, and the title
   * that would explain it is a hover, which a touch screen does not have.
   */
  it.each([
    ['select-all', 'All'],
    ['cut', 'Cut'],
    ['copy', 'Copy'],
    ['paste', 'Paste'],
    ['send-to-back', 'Back'],
    ['bring-to-front', 'Front'],
  ])('labels %s with the readable word %s', (id, label) => {
    expect(findAction({}, id).label).toBe(label);
  });

  /**
   * ⛔ THE TITLES MUST NOT PROMISE A CHORD THE BUTTON DOES NOT SEND. sendToBack and bringToFront send
   * the BARE bracket keys, so a title claiming Ctrl+something would be teaching a GM a shortcut that
   * does not exist on their desktop either.
   */
  it('describes the z-order pair as bracket keys rather than as chords', () => {
    expect(findAction({}, 'send-to-back').title).toContain('[');
    expect(findAction({}, 'send-to-back').title).not.toContain('Ctrl');
    expect(findAction({}, 'bring-to-front').title).toContain(']');
    expect(findAction({}, 'bring-to-front').title).not.toContain('Ctrl');
  });

  it('names the real chord for the four that are chords', () => {
    expect(findAction({}, 'select-all').title).toContain('Ctrl+A');
    expect(findAction({}, 'cut').title).toContain('Ctrl+X');
    expect(findAction({}, 'copy').title).toContain('Ctrl+C');
    expect(findAction({}, 'paste').title).toContain('Ctrl+V');
  });

  /** ⚠️ One group, so six new buttons cluster instead of wrapping through the pan arrows. */
  it.each(MAP_BUTTONS)('puts %s in the map group', (id) => {
    expect(findAction({}, id).group).toBe('map');
  });
});
