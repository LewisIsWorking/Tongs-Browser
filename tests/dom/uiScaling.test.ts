import { beforeEach, describe, expect, it } from 'vitest';

import { HitTester } from '../../src/pointer/HitTester.js';
import { DEFAULT_UI_SCALE } from '../../src/scaling/ScaleRegions.js';
import { UiScaler } from '../../src/scaling/UiScaler.js';

beforeEach(() => {
  document.body.innerHTML = '';
  document.documentElement.className = '';
  document.documentElement.removeAttribute('style');
});

describe('UiScaler', () => {
  function withRegions(): void {
    document.body.innerHTML = `
      <div id="ui-left"></div>
      <div id="ui-right"></div>
      <div id="ui-top"></div>
      <div id="ui-bottom"></div>
    `;
  }

  it('drives every region from a single custom property', () => {
    const scaler = new UiScaler({ document, initialScale: 0.75 });
    scaler.apply();

    expect(document.documentElement.style.getPropertyValue('--tb-ui-scale')).toBe('0.75');
  });

  it('gates the styles behind a class, so removal restores Foundry layout exactly', () => {
    const scaler = new UiScaler({ document });
    scaler.apply();
    expect(document.documentElement.classList.contains('tb-scaled')).toBe(true);

    scaler.remove();
    expect(document.documentElement.classList.contains('tb-scaled')).toBe(false);
    expect(document.documentElement.style.getPropertyValue('--tb-ui-scale')).toBe('');
  });

  /**
   * A region pinned to the right edge that scales about its centre slides inward and leaves a gap,
   * so each region gets the origin matching the edge it is anchored to.
   */
  it('anchors each region to the edge it is pinned to', () => {
    withRegions();
    new UiScaler({ document }).apply();

    expect(document.querySelector<HTMLElement>('#ui-left')?.style.transformOrigin).toBe('top left');
    expect(document.querySelector<HTMLElement>('#ui-right')?.style.transformOrigin).toBe(
      'top right'
    );
    expect(document.querySelector<HTMLElement>('#ui-top')?.style.transformOrigin).toBe(
      'top center'
    );
    expect(document.querySelector<HTMLElement>('#ui-bottom')?.style.transformOrigin).toBe(
      'bottom left'
    );
  });

  it('falls back to alternative selectors when the primary container is absent', () => {
    document.body.innerHTML = '<div id="controls"></div><div id="sidebar"></div>';
    new UiScaler({ document }).apply();

    expect(document.querySelector<HTMLElement>('#controls')?.style.transformOrigin).toBe(
      'top left'
    );
    expect(document.querySelector<HTMLElement>('#sidebar')?.style.transformOrigin).toBe(
      'top right'
    );
  });

  it('normalises an out of range scale rather than applying it raw', () => {
    expect(new UiScaler({ document, initialScale: 9 }).getScale()).toBe(1);
    expect(new UiScaler({ document, initialScale: 0 }).getScale()).toBe(0.5);
  });

  it('defaults to 75 percent', () => {
    expect(new UiScaler({ document }).getScale()).toBe(DEFAULT_UI_SCALE);
  });

  it('reapplies immediately when the scale changes while active', () => {
    const scaler = new UiScaler({ document, initialScale: 0.75 });
    scaler.apply();
    scaler.setScale(0.5);

    expect(document.documentElement.style.getPropertyValue('--tb-ui-scale')).toBe('0.5');
  });

  it('does not apply styles from a scale change while inactive', () => {
    const scaler = new UiScaler({ document });
    scaler.setScale(0.5);

    expect(scaler.getScale()).toBe(0.5);
    expect(document.documentElement.classList.contains('tb-scaled')).toBe(false);
  });

  it('re-resolves regions on each apply, since Foundry rebuilds them on scene change', () => {
    const scaler = new UiScaler({ document });
    scaler.apply();

    withRegions();
    scaler.apply();

    expect(document.querySelector<HTMLElement>('#ui-left')?.style.transformOrigin).toBe('top left');
  });
});
describe('scaling and hit testing must stay decoupled', () => {
  it('hit tests at raw viewport coordinates by default, applying no conversion', () => {
    const calls: [number, number][] = [];
    const tester = new HitTester({
      elementFromPoint: (x, y) => {
        calls.push([x, y]);
        return null;
      },
      getViewport: () => ({ width: 1000, height: 800 }),
    });

    new UiScaler({ document, initialScale: 0.5 }).apply();
    tester.resolve({ clientX: 120, clientY: 120 });

    expect(calls).toEqual([[120, 120]]);
  });
});
