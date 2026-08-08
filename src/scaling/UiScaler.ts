import { SCALE_REGIONS, DEFAULT_UI_SCALE, normaliseScale } from './ScaleRegions.js';

export interface UiScalerOptions {
  readonly document: Document;
  readonly initialScale?: number;
}

const SCALE_PROPERTY = '--tb-ui-scale';
const SCALED_CLASS = 'tb-scaled';

/**
 * Scales Foundry's HTML chrome so it fits a phone.
 *
 * Foundry's interface assumes 1024px or wider. At native size on a phone the sidebar alone can take
 * most of the screen. Scaling the chrome buys back the space without touching the canvas.
 *
 * A single CSS custom property drives every region, so changing the scale is one write and the
 * browser handles the rest. Each region carries its own transform origin, because a region pinned
 * to the right edge that scales about its centre slides inward and leaves a gap.
 *
 * The important coupling: transform: scale() breaks document.elementFromPoint, which works in
 * unscaled viewport coordinates. Anything hit testing against scaled content has to convert first,
 * which is what getTransform is for and why the pointer's HitTester takes one.
 */
export class UiScaler {
  private scale: number;
  private applied = false;

  public constructor(private readonly options: UiScalerOptions) {
    this.scale = normaliseScale(options.initialScale ?? DEFAULT_UI_SCALE);
  }

  public getScale(): number {
    return this.scale;
  }

  public isApplied(): boolean {
    return this.applied;
  }

  public apply(): void {
    this.applied = true;
    const root = this.options.document.documentElement;
    root.style.setProperty(SCALE_PROPERTY, String(this.scale));
    root.classList.add(SCALED_CLASS);
    this.applyRegionOrigins();
  }

  public setScale(scale: number): void {
    this.scale = normaliseScale(scale);
    if (this.applied) {
      this.apply();
    }
  }

  /**
   * Removes the scaling entirely.
   *
   * The custom property is removed rather than set back to 1, so the stylesheet's own default takes
   * over and nothing is left behind if the module is uninstalled while disabled.
   */
  public remove(): void {
    this.applied = false;
    const root = this.options.document.documentElement;
    root.style.removeProperty(SCALE_PROPERTY);
    root.classList.remove(SCALED_CLASS);

    for (const region of SCALE_REGIONS) {
      const element = this.resolveRegion(region.selectors);
      element?.style.removeProperty('transform-origin');
    }
  }

  /**
   * Regions are resolved fresh each time rather than cached, because Foundry rebuilds these
   * containers on scene changes and a cached reference would go stale and silently stop applying.
   */
  private applyRegionOrigins(): void {
    for (const region of SCALE_REGIONS) {
      const element = this.resolveRegion(region.selectors);
      if (element !== null) {
        element.style.transformOrigin = region.transformOrigin;
      }
    }
  }

  private resolveRegion(selectors: readonly string[]): HTMLElement | null {
    for (const selector of selectors) {
      const element = this.options.document.querySelector<HTMLElement>(selector);
      if (element !== null) {
        return element;
      }
    }
    return null;
  }
}
