import { MODULE_ID } from '../constants.js';

/**
 * A GM-only button in the module settings that opens something. Added 2026-09-15, extracted from the
 * sign-in menu when the party campaigns menu needed the same.
 *
 * ⛔ FOUND LIVE, 2026-09-15: `registerMenu` THROWS unless the type is a FormApplication or ApplicationV2
 * subclass ("You must provide a menu type that is a FormApplication or ApplicationV2 instance or
 * subclass"), and a throw there aborted the REST of Tongs' init hook. A plain class passed every unit
 * test. So the menu extends Foundry's own ApplicationV2, and registering it can never throw out of here.
 *
 * ⚠️ Foundry opens a menu with `new menu.type().render(true)`, so `render` is where the work starts.
 */
export interface MenuGlobals {
  readonly foundry?: {
    readonly applications?: {
      readonly api?: {
        readonly ApplicationV2?: new (...args: never[]) => { render(...args: never[]): unknown };
      };
    };
  };
}

export interface MenuSettings {
  registerMenu?(namespace: string, key: string, data: object): void;
}

export interface MenuEntry {
  readonly key: string;
  readonly name: string;
  readonly label: string;
  readonly hint: string;
  readonly icon: string;
}

/** True when the menu was registered. False, never a throw, when Foundry refuses or cannot. */
export function registerGmMenu(
  settings: MenuSettings,
  globals: MenuGlobals,
  entry: MenuEntry,
  open: () => Promise<unknown>
): boolean {
  const Base = globals.foundry?.applications?.api?.ApplicationV2;
  if (Base === undefined || settings.registerMenu === undefined) {
    return false;
  }
  class GmMenu extends Base {
    public override render(): this {
      void open();
      return this;
    }
  }
  try {
    settings.registerMenu(MODULE_ID, entry.key, {
      name: entry.name,
      label: entry.label,
      hint: entry.hint,
      icon: entry.icon,
      type: GmMenu,
      restricted: true,
    });
    return true;
  } catch {
    return false;
  }
}

/** Text safe to put inside Foundry's dialog HTML. */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => `&#${String(ch.charCodeAt(0))};`);
}
