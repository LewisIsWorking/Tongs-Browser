import { describe, expect, it, vi } from 'vitest';

import { keepMirrorTicks, startTokenFacing } from '../../src/facing/startTokenFacing.js';
import { facingWorld as world } from './support/facingWorld.js';

/**
 * Keeping the Mirror ticks in PF2e's Prototype Token form when its auto-scale locks the Scale slider,
 * 2026-11-14. Moved out of startTokenFacing.test.ts on 2026-11-18 when the vision tests filled that file.
 */
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
