import { describe, expect, it, vi } from 'vitest';

import { buildTrayActions, PAN_STEP, ZOOM_STEP } from '../../src/ui/TrayActions.js';
import { findAction, handlers } from './support/trayHandlers.js';

/**
 * The action tray.
 *
 * What is worth protecting here is the CONTENT, not the wiring. A build catches a missing handler; it
 * cannot catch a pan button that goes the wrong way, a grab that never says DROP, or a button that
 * quietly stopped existing.
 */
const find = findAction;

describe('buildTrayActions', () => {
  /** A button that silently stops existing is invisible to every other test in this file. */
  it('offers every button the tray is meant to have, once each', () => {
    const ids = buildTrayActions(handlers()).map((action) => action.id);

    expect(ids).toEqual([
      'sidebar',
      'character',
      'create-sheet',
      'party-access',
      'pause',
      'grab',
      'diagnose',
      'zoom-in',
      'zoom-out',
      'pan-left',
      'pan-right',
      'pan-up',
      'pan-down',
    ]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every button a title, because it is the only text a glyph has', () => {
    for (const action of buildTrayActions(handlers())) {
      expect(action.title.length).toBeGreaterThan(0);
      expect(action.label.length).toBeGreaterThan(0);
    }
  });

  describe('grab', () => {
    /**
     * ⚠️ The regression this exists for. A latched button whose label never changes cost a whole
     * round of device diagnostics: the gold styling said "on", but "on" does not tell you the next
     * thing to do is tap it OFF, and Foundry only commits a token's move on the DROP. A report came
     * back mid drag with the token quite correctly sitting where it started.
     */
    it('says DROP while a grab is held, not just looks latched', () => {
      expect(find({ isDragging: () => true }, 'grab').getLabel?.()).toBe('DROP');
      expect(find({ isDragging: () => false }, 'grab').getLabel?.()).toBe('✋');
    });

    it('reports its held state, so the button can latch at all', () => {
      expect(find({ isDragging: () => true }, 'grab').isActive?.()).toBe(true);
      expect(find({ isDragging: () => false }, 'grab').isActive?.()).toBe(false);
    });

    it('toggles: begins a drag when idle, ends the one it is holding', () => {
      const beginDrag = vi.fn();
      const endDrag = vi.fn();

      find({ isDragging: () => false, beginDrag, endDrag }, 'grab').activate();
      expect(beginDrag).toHaveBeenCalledOnce();
      expect(endDrag).not.toHaveBeenCalled();

      find({ isDragging: () => true, beginDrag, endDrag }, 'grab').activate();
      expect(endDrag).toHaveBeenCalledOnce();
    });
  });

  describe('pan', () => {
    /**
     * ⚠️ The signs read backwards on purpose, and this is the assertion that says so.
     *
     * Pressing right moves the VIEW right, which is the same as dragging the map LEFT, so the delta
     * is negated. Getting it wrong produces four buttons that work perfectly and all go the wrong
     * way, which no build and no type can catch and which a user notices immediately.
     */
    it.each([
      ['pan-left', PAN_STEP, 0],
      ['pan-right', -PAN_STEP, 0],
      ['pan-up', 0, PAN_STEP],
      ['pan-down', 0, -PAN_STEP],
    ])('%s moves the view by (%i, %i)', (id, deltaX, deltaY) => {
      const panBy = vi.fn();

      find({ panBy }, id).activate();

      expect(panBy).toHaveBeenCalledWith(deltaX, deltaY);
    });

    it('groups the arrows together, so they can be laid out as a cluster', () => {
      const arrows = buildTrayActions(handlers()).filter((action) => action.id.startsWith('pan-'));

      expect(arrows).toHaveLength(4);
      expect(arrows.every((action) => action.group === 'pan')).toBe(true);
    });
  });

  describe('zoom', () => {
    /** Reciprocal, not a subtraction: zooming out then in must land back where it started. */
    it('zooms out by exactly the reciprocal of zooming in', () => {
      const zoomBy = vi.fn();

      find({ zoomBy }, 'zoom-in').activate();
      find({ zoomBy }, 'zoom-out').activate();

      expect(zoomBy).toHaveBeenNthCalledWith(1, ZOOM_STEP);
      expect(zoomBy).toHaveBeenNthCalledWith(2, 1 / ZOOM_STEP);
      expect(ZOOM_STEP * (1 / ZOOM_STEP)).toBe(1);
    });
  });

  describe('pause', () => {
    it('reports the paused state so the button can show it', () => {
      expect(find({ isPaused: () => true }, 'pause').isActive?.()).toBe(true);
      expect(find({ isPaused: () => false }, 'pause').isActive?.()).toBe(false);
    });
  });

  describe('the momentary buttons', () => {
    it.each([
      ['sidebar', 'toggleSidebar'],
      ['character', 'openCharacterSheet'],
      ['pause', 'togglePause'],
      ['diagnose', 'whisperDiagnostics'],
    ] as const)('%s calls %s', (id, handlerName) => {
      const handler = vi.fn();

      find({ [handlerName]: handler }, id).activate();

      expect(handler).toHaveBeenCalledOnce();
    });

    /** Momentary actions have no state to show, and a latch on one would invite an undoing tap. */
    it.each(['sidebar', 'character', 'diagnose', 'zoom-in', 'zoom-out', 'pan-left'])(
      '%s reports no active state',
      (id) => {
        expect(find({}, id).isActive).toBeUndefined();
      }
    );
  });
});
