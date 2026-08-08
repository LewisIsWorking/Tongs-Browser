import type { Logger } from '../core/Logger.js';
import {
  DEFAULT_CLAMP_LIMITS,
  clampWindow,
  needsClamping,
  type ClampLimits,
} from './WindowClamp.js';

export interface WindowClampBinderOptions {
  readonly document: Document;
  readonly window: Window;
  readonly limits?: ClampLimits;
  readonly logger?: Logger;
}

/**
 * Selectors covering both window generations.
 *
 * Foundry has two application systems in play at once: the legacy Application rendering `.app
 * .window-app`, and ApplicationV2 rendering `.application`. Systems and modules are mid migration,
 * so a real world PF2e session has both on screen at the same time and handling only one leaves
 * half the windows unreachable.
 */
const WINDOW_SELECTORS = ['.app.window-app', '.application'] as const;

/**
 * Applies clamping to rendered application windows.
 *
 * Bound to Foundry's render hooks for both generations. Hooks are used rather than a MutationObserver
 * because Foundry positions a window after inserting it, so observing insertion would measure the
 * pre positioned rect and correct against stale numbers.
 */
export class WindowClampBinder {
  private readonly limits: ClampLimits;
  private hookIds: { hook: string; id: number }[] = [];

  public constructor(private readonly options: WindowClampBinderOptions) {
    this.limits = options.limits ?? DEFAULT_CLAMP_LIMITS;
  }

  public bind(): void {
    if (this.hookIds.length > 0) {
      return;
    }
    for (const hook of ['renderApplication', 'renderApplicationV2']) {
      const id = Hooks.on(hook, (): void => {
        this.clampAll();
      });
      this.hookIds.push({ hook, id });
    }
    this.clampAll();
  }

  public unbind(): void {
    for (const entry of this.hookIds) {
      Hooks.off(entry.hook, entry.id);
    }
    this.hookIds = [];
  }

  public isBound(): boolean {
    return this.hookIds.length > 0;
  }

  /** Clamps every currently rendered window. Exposed so a scale change can re-run it. */
  public clampAll(): void {
    for (const element of this.collectWindows()) {
      this.clampElement(element);
    }
  }

  public clampElement(element: HTMLElement): void {
    const viewport = {
      width: this.options.window.innerWidth,
      height: this.options.window.innerHeight,
    };

    /*
     * offsetWidth rather than getBoundingClientRect, because the rect reports the post transform
     * size. Windows sit inside scaled regions, so the rect would already have the scale baked in and
     * clamping against it would shrink them a second time on every render.
     */
    const rect = {
      left: element.offsetLeft,
      top: element.offsetTop,
      width: element.offsetWidth,
      height: element.offsetHeight,
    };

    if (!needsClamping(rect, viewport, this.limits)) {
      return;
    }

    const clamped = clampWindow(rect, viewport, this.limits);
    element.style.left = `${String(clamped.left)}px`;
    element.style.top = `${String(clamped.top)}px`;
    element.style.maxWidth = `${String(Math.round(this.limits.maxWidthFraction * 100))}vw`;
    element.style.maxHeight = `${String(Math.round(this.limits.maxHeightFraction * 100))}vh`;

    this.options.logger?.debug('Clamped an application window into the viewport.');
  }

  private collectWindows(): HTMLElement[] {
    const found = new Set<HTMLElement>();
    for (const selector of WINDOW_SELECTORS) {
      for (const element of this.options.document.querySelectorAll<HTMLElement>(selector)) {
        found.add(element);
      }
    }
    return [...found];
  }
}
