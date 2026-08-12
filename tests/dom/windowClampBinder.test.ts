import { beforeEach, describe, expect, it } from 'vitest';

import { WindowClampBinder } from '../../src/scaling/WindowClampBinder.js';

beforeEach(() => {
  document.body.innerHTML = '';
  document.documentElement.className = '';
  document.documentElement.removeAttribute('style');
});

describe('WindowClampBinder', () => {
  function makeWindow(
    className: string,
    rect: { left: number; top: number; width: number; height: number }
  ): HTMLElement {
    const element = document.createElement('div');
    element.className = className;
    document.body.append(element);

    // jsdom reports zero for every layout property, so the offsets are defined explicitly.
    Object.defineProperty(element, 'offsetLeft', { value: rect.left, configurable: true });
    Object.defineProperty(element, 'offsetTop', { value: rect.top, configurable: true });
    Object.defineProperty(element, 'offsetWidth', { value: rect.width, configurable: true });
    Object.defineProperty(element, 'offsetHeight', { value: rect.height, configurable: true });
    return element;
  }

  function binder(): WindowClampBinder {
    return new WindowClampBinder({
      document,
      window: { innerWidth: 400, innerHeight: 800 } as Window,
    });
  }

  /**
   * Foundry has two application systems live at once and a real PF2e session has both on screen, so
   * handling only one leaves half the windows unreachable.
   */
  it('handles legacy Application windows', () => {
    const element = makeWindow('app window-app', { left: 350, top: 10, width: 300, height: 200 });
    binder().clampAll();

    expect(element.style.left).toBe('100px');
  });

  it('handles ApplicationV2 windows', () => {
    const element = makeWindow('application', { left: 350, top: 10, width: 300, height: 200 });
    binder().clampAll();

    expect(element.style.left).toBe('100px');
  });

  it('counts a window matching both selectors only once', () => {
    const element = makeWindow('app window-app application', {
      left: 350,
      top: 10,
      width: 300,
      height: 200,
    });
    binder().clampAll();

    expect(element.style.left).toBe('100px');
  });

  it('caps size as well as position', () => {
    const element = makeWindow('application', { left: 0, top: 0, width: 2000, height: 2000 });
    binder().clampAll();

    expect(element.style.maxWidth).toBe('95vw');
    expect(element.style.maxHeight).toBe('90vh');
  });

  it('leaves a window that already fits untouched', () => {
    const element = makeWindow('application', { left: 10, top: 10, width: 100, height: 100 });
    binder().clampAll();

    expect(element.style.left).toBe('');
    expect(element.style.top).toBe('');
  });
});
