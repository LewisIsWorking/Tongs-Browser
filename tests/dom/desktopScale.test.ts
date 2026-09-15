import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { bootMain } from './support/mainUnderTest.js';
import { SettingKey } from '../../src/settings/SettingDefinitions.js';
import { UiScaler } from '../../src/scaling/UiScaler.js';

/**
 * ⛔ Found live on Forge, 2026-09-15: a GM switched Tongs on at a desktop to reach the roll deck, the
 * interface shrank to 75%, and the sidebar could no longer be reached. The scale is for phones and
 * tablets only.
 */
const scaled = () => document.documentElement.classList.contains('tb-scaled');
const original = window.matchMedia;
const pointer = (coarse: boolean) => {
  window.matchMedia = ((query: string) => ({
    matches: coarse && query === '(pointer: coarse)',
  })) as unknown as typeof window.matchMedia;
};

beforeEach(() => {
  document.body.innerHTML = '';
  document.documentElement.className = '';
  document.documentElement.removeAttribute('style');
});
afterEach(() => {
  window.matchMedia = original;
});

describe('scaling the interface only where it is needed', () => {
  it('leaves the interface alone when the device may not be scaled, even after a scale change', () => {
    const scaler = new UiScaler({ document, initialScale: 0.75, allowed: () => false });
    scaler.apply();
    scaler.setScale(0.6);

    expect(scaled()).toBe(false);
    expect(scaler.isApplied()).toBe(false);
    expect(document.documentElement.style.getPropertyValue('--tb-ui-scale')).toBe('');
  });

  it('scales when the device may be scaled', () => {
    new UiScaler({ document, allowed: () => true }).apply();
    expect(scaled()).toBe(true);
  });

  it('never shrinks a desktop Foundry when the module is switched on there', async () => {
    pointer(false);
    const { hooks, moduleEntry } = await bootMain({ [SettingKey.ENABLED]: true });
    hooks.once.get('init')?.();
    hooks.once.get('ready')?.();

    expect((moduleEntry.api as { isEnabled: () => boolean }).isEnabled()).toBe(true);
    expect(scaled()).toBe(false);
  });

  it('still shrinks it on a phone or tablet', async () => {
    pointer(true);
    const { hooks } = await bootMain({ [SettingKey.ENABLED]: true });
    hooks.once.get('init')?.();
    hooks.once.get('ready')?.();

    expect(scaled()).toBe(true);
  });
});
