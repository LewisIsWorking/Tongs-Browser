import { beforeEach, describe, expect, it } from 'vitest';

import { bootMain } from './support/mainUnderTest.js';
import type { TongsBrowser } from '../../src/TongsBrowser.js';

/**
 * The three callbacks `main.ts` hands out and nothing invoked. Written 2026-08-31.
 *
 * ⚠️ All three are read LIVE rather than captured, which is what makes a setting take effect without
 * a reload. The cost of that design is that none of them runs at startup, so none was reached by a
 * test that only booted the module.
 *
 *   the suppressor's `enabled`  decides whether native touch is eaten, on every single event
 *   onBarPositionChanged        persists where the bar was dragged to
 *   onBarCollapsedChanged       persists whether it was left open
 *
 * COVERS: a callback wired to the wrong setting, or a suppression predicate with the wrong logic.
 * MISSES: whether Foundry actually calls them. The harness suites cover that on a real device.
 */
interface Booted {
  hooks: { once: Map<string, () => void> };
  settings: { stored: Map<string, unknown> };
  moduleEntry: { api?: unknown };
}

async function bootToReady(values: Record<string, unknown> = {}): Promise<Booted> {
  const booted = (await bootMain(values)) as unknown as Booted;
  booted.hooks.once.get('init')?.();
  booted.hooks.once.get('ready')?.();
  return booted;
}

/**
 * A touch-derived pointer event jsdom will carry.
 *
 * ⚠️ Built as a plain `Event` with the two properties the suppressor reads defined on it. jsdom's
 * `PointerEvent` support is not something this suite should depend on, and `pointerType` plus
 * `pointerId` is the entire surface being stood in for.
 */
function touchPointerEvent(type: string): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'pointerType', { value: 'touch' });
  Object.defineProperty(event, 'pointerId', { value: 7 });
  return event;
}

/**
 * Whether the suppressor swallowed the event.
 *
 * The suppressor binds on the WINDOW in the capture phase and calls `stopImmediatePropagation`, which
 * stops later listeners on that same node. This one is registered afterwards, so it runs second and
 * simply does not fire when the event was suppressed.
 */
function wasSuppressed(target: EventTarget): boolean {
  let sawIt = false;
  const listener = (): void => {
    sawIt = true;
  };
  window.addEventListener('pointerdown', listener, { capture: true });
  target.dispatchEvent(touchPointerEvent('pointerdown'));
  window.removeEventListener('pointerdown', listener, { capture: true });
  return !sawIt;
}

function plainTarget(): HTMLElement {
  const element = document.createElement('div');
  document.body.append(element);
  return element;
}

beforeEach(() => {
  document.body.innerHTML = '';
});

/**
 * ⚠️ ONE boot, walking the truth table by changing the stored settings between assertions.
 *
 * Not four separate boots, and the reason is the thing under test. `BuildSuppressor` says "nothing
 * unbinds it, deliberately: `enabled` is read live on every event, so it goes inert the moment the
 * module or the setting is switched off." A suppressor from an earlier test therefore stays bound to
 * the shared jsdom window for the rest of the file and keeps answering from ITS OWN store, so four
 * boots measure the first one forever. The first draft of this suite did exactly that and reported
 * every negative case as suppressed.
 *
 * Flipping the settings under a single suppressor is both immune to that and a stronger assertion:
 * it proves the predicate is re-read per event rather than captured at init, which is the whole
 * reason a setting change takes effect without a reload.
 */
describe('when native touch is suppressed', () => {
  it('suppresses only while the module is on AND the setting asks for it', async () => {
    const booted = await bootToReady({ enabled: true, suppressNativeTouch: true });
    const settings = booted.settings.stored;
    const verdicts: Record<string, boolean> = {};

    for (const [enabled, suppress] of [
      [true, true],
      [false, true],
      [true, false],
      [false, false],
    ] as const) {
      settings.set('enabled', enabled);
      settings.set('suppressNativeTouch', suppress);
      verdicts[`enabled=${String(enabled)} suppress=${String(suppress)}`] =
        wasSuppressed(plainTarget());
    }

    expect(verdicts).toEqual({
      'enabled=true suppress=true': true,
      // ⚠️ THE CASE THAT MATTERS. Suppressing while the module is OFF eats touch events Foundry
      // needs, for a user who most likely switched it off because something was misbehaving. There
      // would be no way back short of uninstalling.
      'enabled=false suppress=true': false,
      'enabled=true suppress=false': false,
      'enabled=false suppress=false': false,
    });
  });
});

describe('what the bar persists when it moves', () => {
  /**
   * ⚠️ Asserts the STORED VALUE, not merely that something was stored. The first draft used
   * `toBeTruthy()` and passed while passing `{ left, top }`, which is not the shape `BarPosition`
   * declares at all - `tsc` caught it, the test did not. A truthiness assertion on a serialised blob
   * cannot tell a correct position from any other object.
   */
  it('stores the position the bar was moved to', async () => {
    const booted = await bootToReady({ enabled: true });
    const api = booted.moduleEntry.api as TongsBrowser;

    api.getModifierBar().setPosition({ x: 123, y: 45 });

    expect(JSON.parse(String(booted.settings.stored.get('barPosition')))).toEqual({
      x: 123,
      y: 45,
    });
  });

  /**
   * ⚠️ Persisted so expanding the bar survives a reload. Without this the bar reopens collapsed
   * every session, which reads as the module forgetting rather than as a missing callback.
   */
  it('stores whether the bar was left expanded', async () => {
    const booted = await bootToReady({ enabled: true, barCollapsed: true });
    const api = booted.moduleEntry.api as TongsBrowser;

    api.getModifierBar().setCollapsed(false);

    expect(booted.settings.stored.get('barCollapsed')).toBe(false);
  });

  it('stores that it was left collapsed', async () => {
    const booted = await bootToReady({ enabled: true, barCollapsed: false });
    const api = booted.moduleEntry.api as TongsBrowser;

    api.getModifierBar().setCollapsed(true);

    expect(booted.settings.stored.get('barCollapsed')).toBe(true);
  });
});
