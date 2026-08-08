/**
 * Minimal, hand written ambient types for the Foundry globals this module actually touches.
 *
 * The community package @league-of-foundry-developers/foundry-vtt-types is not usable here: its
 * newest published build targets 13.346 and there is no v14 release, so pulling it in would type
 * this module against an API generation it does not run on. A small honest surface beats a large
 * wrong one.
 *
 * Rule for this file: only add a member once something in src actually calls it. Everything here
 * should be traceable to a real call site.
 */

export {};

/**
 * Hook callbacks take never[] rather than unknown[] on purpose. Parameters are checked
 * contravariantly, and never is assignable to every type, so this accepts a concretely typed
 * callback such as (app: Application, html: HTMLElement) => void while still refusing to let us
 * invoke a hook callback blindly from our own code.
 */
type HookCallback = (...args: never[]) => unknown;

declare global {
  interface FoundrySettingRange {
    min: number;
    max: number;
    step: number;
  }

  interface FoundrySettingRegistration {
    name: string;
    hint?: string;
    scope: 'client' | 'world';
    config: boolean;
    type: NumberConstructor | StringConstructor | BooleanConstructor;
    default: unknown;
    range?: FoundrySettingRange;
    choices?: Record<string, string>;
    onChange?: (value: unknown) => void;
  }

  interface FoundryClientSettings {
    register(namespace: string, key: string, data: FoundrySettingRegistration): void;
    get(namespace: string, key: string): unknown;
    set(namespace: string, key: string, value: unknown): Promise<unknown>;
  }

  interface FoundryModuleEntry {
    id: string;
    active: boolean;
    api?: unknown;
  }

  /**
   * Foundry tracks held keys internally by KeyboardEvent.code, and a great deal of core and system
   * code asks this object rather than reading the event. Whether it accepts synthetic events is the
   * open question that decides the modifier bar design, so downKeys is declared optional.
   */
  interface FoundryKeyboardManager {
    downKeys?: Set<string>;
    isModifierActive(modifier: string): boolean;
  }

  interface FoundryI18n {
    localize(key: string): string;
    format(key: string, data: Record<string, unknown>): string;
  }

  interface FoundryGame {
    ready: boolean;
    settings: FoundryClientSettings;
    keyboard?: FoundryKeyboardManager;
    modules: Map<string, FoundryModuleEntry>;
    i18n: FoundryI18n;
  }

  interface FoundryCanvasPanOptions {
    x?: number;
    y?: number;
    scale?: number;
  }

  interface FoundryCanvasApp {
    view: HTMLCanvasElement;
  }

  interface FoundryCanvas {
    ready: boolean;
    app?: FoundryCanvasApp;
    pan(options: FoundryCanvasPanOptions): void;
  }

  interface FoundryNotifications {
    info(message: string): void;
    warn(message: string): void;
    error(message: string): void;
  }

  interface FoundryUi {
    notifications?: FoundryNotifications;
  }

  interface FoundryHooks {
    on(hook: string, callback: HookCallback): number;
    once(hook: string, callback: HookCallback): number;
    off(hook: string, callback: number | HookCallback): void;
    callAll(hook: string, ...args: unknown[]): boolean;
  }

  interface FoundryCanvasConfig {
    minZoom?: number;
    maxZoom?: number;
  }

  interface FoundryConfig {
    Canvas: FoundryCanvasConfig;
  }

  interface FoundryKeyboardManagerStatic {
    MODIFIER_KEYS: {
      CONTROL: string;
      SHIFT: string;
      ALT: string;
    };
  }

  /**
   * Declared as possibly undefined because this module's entry point runs during init, before
   * Foundry has finished populating every global. Guarding is not optional.
   */
  const game: FoundryGame | undefined;
  const canvas: FoundryCanvas | undefined;
  const ui: FoundryUi | undefined;
  const CONFIG: FoundryConfig | undefined;
  const KeyboardManager: FoundryKeyboardManagerStatic | undefined;
  const Hooks: FoundryHooks;
}
