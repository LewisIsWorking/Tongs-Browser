import { describe, expect, it, vi } from 'vitest';

import {
  FACING_SETTING,
  keepMirrorTicks,
  startTokenFacing,
} from '../../src/facing/startTokenFacing.js';
import { facingWorld as world } from './support/facingWorld.js';

/**
 * Default token facing's wiring, 2026-11-14: the world setting, the creation hooks, and keeping the
 * Mirror ticks when PF2e's auto-scale locks the Scale slider. The GM's button: applyTokenFacing.test.ts.
 */
const creating = (source: object) => ({ _source: source, updateSource: vi.fn() });

describe('the default token facing setting', () => {
  it('is a world setting, shown in the settings, and on by default', () => {
    const w = world();
    startTokenFacing(w.hooks, w.settings, w.globals);

    expect(w.settings.register).toHaveBeenCalledWith(
      'tongs-browser',
      FACING_SETTING,
      expect.objectContaining({
        name: 'Default token facing: mirror both ways, unlocked rotation',
        scope: 'world',
        config: true,
        type: Boolean,
        default: true,
      })
    );
  });
});

describe('a new actor', () => {
  it("gets a prototype mirrored both ways and free to turn, over PF2e's locked rotation", () => {
    const w = world();
    startTokenFacing(w.hooks, w.settings, w.globals);
    const actor = creating({
      prototypeToken: { texture: { scaleX: 1, scaleY: 1 }, lockRotation: true },
    });

    w.handlers.get('preCreateActor')?.(actor, { name: 'Goblin' }, {}, 'gm');

    expect(actor.updateSource).toHaveBeenCalledWith({
      prototypeToken: { texture: { scaleX: -1, scaleY: -1 }, lockRotation: false },
    });
  });

  it('keeps a mirror its creator asked for', () => {
    const w = world();
    startTokenFacing(w.hooks, w.settings, w.globals);
    const actor = creating({ prototypeToken: { texture: { scaleX: -1, scaleY: 1 } } });

    w.handlers.get('preCreateActor')?.(actor, { prototypeToken: { texture: { scaleX: -1 } } });

    expect(actor.updateSource).not.toHaveBeenCalled();
  });

  it('is left alone when a GM has switched the setting off', () => {
    const w = world({ on: false });
    startTokenFacing(w.hooks, w.settings, w.globals);
    const actor = creating({ prototypeToken: { texture: { scaleX: 1, scaleY: 1 } } });

    w.handlers.get('preCreateActor')?.(actor, {});

    expect(actor.updateSource).not.toHaveBeenCalled();
  });
});

describe('a new token', () => {
  it('with art mirrored both ways is placed at 180, upright', () => {
    const w = world();
    startTokenFacing(w.hooks, w.settings, w.globals);
    const token = creating({ texture: { scaleX: -1, scaleY: -1 }, rotation: 0 });

    w.handlers.get('preCreateToken')?.(token, {}, {}, 'player');

    expect(token.updateSource).toHaveBeenCalledWith({ rotation: 180 });
  });

  it('is left alone when unmirrored, already turned, or the setting is off', () => {
    const w = world();
    startTokenFacing(w.hooks, w.settings, w.globals);
    const plain = creating({ texture: { scaleX: 1, scaleY: 1 }, rotation: 0 });
    const turned = creating({ texture: { scaleX: -1, scaleY: -1 }, rotation: 45 });
    const bare = { updateSource: vi.fn() };
    w.handlers.get('preCreateToken')?.(plain);
    w.handlers.get('preCreateToken')?.(turned);
    w.handlers.get('preCreateToken')?.(bare);
    const off = world({ on: false });
    startTokenFacing(off.hooks, off.settings, off.globals);
    const mirrored = creating({ texture: { scaleX: -1, scaleY: -1 } });
    off.handlers.get('preCreateToken')?.(mirrored);

    for (const token of [plain, turned, bare, mirrored]) {
      expect(token.updateSource).not.toHaveBeenCalled();
    }
  });
});

describe('the Mirror ticks with PF2e auto-scale on (PF2e 8.7, Foundry 14.370)', () => {
  const form = () => {
    const listeners: ((event: Event) => void)[] = [];
    return {
      listeners,
      addEventListener: vi.fn((_type: string, listener: (event: Event) => void) =>
        listeners.push(listener)
      ),
      fire: (object: Record<string, unknown>) => {
        for (const listener of listeners) {
          listener({ formData: { object } } as unknown as Event);
        }
        return object;
      },
    };
  };

  it('fills in the saved size the locked slider left out, so core keeps the ticks', () => {
    const f = form();
    keepMirrorTicks({
      form: f as unknown as EventTarget,
      token: { _source: { texture: { scaleX: -0.8 } } },
    });

    expect(f.addEventListener).toHaveBeenCalledWith('formdata', expect.any(Function));
    expect(f.fire({ mirrorX: true, mirrorY: true })).toEqual({
      mirrorX: true,
      mirrorY: true,
      scale: 0.8,
    });
  });

  it('leaves a submitted scale alone, as once PF2e or core fixes this', () => {
    const f = form();
    keepMirrorTicks({ form: f as unknown as EventTarget });

    expect(f.fire({ scale: 1.2, mirrorX: true })).toEqual({ scale: 1.2, mirrorX: true });
    expect(f.fire({ mirrorY: true })).toEqual({ mirrorY: true, scale: 1 });
    f.listeners[0]?.({} as Event);
  });

  it('listens once per form, however often it renders, and on every Prototype Token form', () => {
    const f = form();
    const app = { form: f as unknown as EventTarget };
    keepMirrorTicks(app);
    keepMirrorTicks(app);
    keepMirrorTicks({ form: null });
    keepMirrorTicks({});
    const w = world();
    startTokenFacing(w.hooks, w.settings, w.globals);

    expect(f.addEventListener).toHaveBeenCalledTimes(1);
    expect(w.handlers.get('renderPrototypeTokenConfig')).toBe(keepMirrorTicks);
  });
});
