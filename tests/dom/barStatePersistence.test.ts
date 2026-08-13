import { beforeEach, describe, expect, it } from 'vitest';

import { buildModule, stubFoundryEnvironment } from './support/moduleUnderTest.js';

/**
 * Whether the bar's own state survives being handed out and handed back. Written 2026-08-13.
 *
 * ⚠️ THE WIRING, not the components, and that distinction is the whole reason this file exists.
 *
 * `ModifierBar` has fired `onCollapsedChanged` since it was written, and modifierBarLifecycle.test.ts
 * has asserted exactly that all along. The matching option was declared on `TongsBrowserOptions`,
 * correctly typed, and forwarded by NOBODY: `BuildModifierBar` passed the position pair and simply
 * omitted the collapsed pair. So the bar dutifully announced every collapse to no one, and the state
 * was discarded on every reload.
 *
 * Every part correct, every part covered, the seam between them empty. Nothing was red, because
 * nothing looked at the join. It stayed invisible for as long as the bar opened expanded, and became
 * a complaint within an hour of it opening collapsed.
 *
 * Both directions are asserted for both properties. A one way wire is the same bug wearing a hat, and
 * pinning position beside collapsed is what stops the pair drifting apart again.
 */
beforeEach(() => {
  stubFoundryEnvironment();
});

const collapseButton = (module: ReturnType<typeof buildModule>) =>
  module
    .getModifierBar()
    .getElement()
    .querySelector<HTMLButtonElement>('.tb-modifier-bar__collapse');

describe('the collapsed state', () => {
  it('opens as it was told, in either direction', () => {
    expect(buildModule({ initialBarCollapsed: true }).getModifierBar().isCollapsed()).toBe(true);
    expect(buildModule({ initialBarCollapsed: false }).getModifierBar().isCollapsed()).toBe(false);
  });

  /** Unset must fall through to the module's own default rather than to a second opinion. */
  it('falls back to the default when nobody says', () => {
    expect(buildModule().getModifierBar().isCollapsed()).toBe(true);
  });

  it('reports every change back out, so the choice can be saved', () => {
    const saved: boolean[] = [];
    const module = buildModule({
      initialBarCollapsed: true,
      onBarCollapsedChanged: (collapsed: boolean) => saved.push(collapsed),
    });
    module.enable();

    collapseButton(module)?.click();
    collapseButton(module)?.click();

    expect(saved).toEqual([false, true]);
  });
});

describe('the position, which had the same shape and was already wired', () => {
  it('opens where it was told', () => {
    const module = buildModule({ initialBarPosition: { x: 40, y: 60 } });

    expect(module.getModifierBar().getPosition()).toEqual({ x: 40, y: 60 });
  });

  it('reports a move back out', () => {
    const saved: { x: number; y: number }[] = [];
    const module = buildModule({
      onBarPositionChanged: (at: { x: number; y: number }) => saved.push(at),
    });

    module.getModifierBar().setPosition({ x: 10, y: 20 });

    expect(saved).toEqual([{ x: 10, y: 20 }]);
  });
});
