/**
 * Reaching Foundry's sidebar on a phone. Extracted from TongsBrowser 2026-08-12.
 *
 * ⚠️ This exists because the sidebar is genuinely unreachable on a small screen, not as a
 * convenience. Foundry auto collapses it below about 1024px into a strip of icons hard against the
 * right edge, and its expander is a few pixels wide, which is not a realistic touch target. A device
 * reported "no side bar" three separate times while the module was otherwise working.
 *
 * The answer is to POP TABS OUT as windows rather than to fight the collapsed strip. A popped out
 * chat or actors tab is a normal Foundry window, so it can be moved, resized and closed with the
 * gestures the module already provides, and nothing depends on hitting a 27px strip with a thumb.
 *
 * Everything here reads Foundry through an injected accessor rather than `globalThis`, which is what
 * makes it testable at all: the composition root was the only thing that could reach these before,
 * and being the composition root is exactly what made them untestable.
 */

/** Foundry's `ui`, described only as far as this reads it. */
export interface FoundryUi {
  readonly sidebar?: {
    readonly constructor?: { readonly TABS?: Record<string, { readonly gmOnly?: boolean }> };
    readonly popouts?: Record<string, { close?: () => unknown } | undefined>;
    readonly expanded?: boolean;
    toggleExpanded?: (expanded?: boolean) => unknown;
  };
  readonly [tab: string]: unknown;
}

export interface SidebarAccessOptions {
  readonly getUi: () => FoundryUi | undefined;
  readonly isGm: () => boolean;
}

/**
 * Which sidebar tabs this user can actually open.
 *
 * Read from the Sidebar class's static TABS, because that is where Foundry defines them; the tab
 * applications themselves are separate objects hanging off `ui`. A tab is only offered when its
 * application exists AND can pop out, so a Foundry build that renames or removes one degrades to a
 * shorter list rather than to a row of buttons that quietly do nothing.
 */
export function resolveSidebarTabNames(options: SidebarAccessOptions): string[] {
  const ui = options.getUi();
  const tabs = ui?.sidebar?.constructor?.TABS;
  if (tabs === undefined) {
    return [];
  }

  const isGm = options.isGm();

  return Object.entries(tabs)
    .filter(([, definition]) => definition.gmOnly !== true || isGm)
    .map(([name]) => name)
    .filter((name) => {
      const app = ui?.[name] as { renderPopout?: () => unknown } | undefined;
      return app?.renderPopout !== undefined;
    });
}

/**
 * Pop a named sidebar tab out as a window, closing it again if it is already open.
 *
 * Toggling rather than always opening, because the button that reaches this is the only way back:
 * an open chat window with no way to dismiss it would cover the map on a phone, which is the problem
 * this feature exists to solve rather than a new one to introduce.
 */
export function popOutSidebarTab(options: SidebarAccessOptions, name: string): void {
  const ui = options.getUi();

  const open = ui?.sidebar?.popouts?.[name];
  if (open?.close !== undefined) {
    void open.close();
    return;
  }

  const app = ui?.[name] as { renderPopout?: () => unknown } | undefined;
  void app?.renderPopout?.();
}

/**
 * Expand or collapse Foundry's own sidebar, if this build lets us.
 *
 * Returns whether it worked, so a caller can fall back to the tab picker rather than leave the user
 * tapping a button that does nothing. Measured on 14.365: `toggleExpanded` exists and works, but it
 * expands the sidebar over most of a phone screen, which is why the popout path is preferred and
 * this is the fallback rather than the other way round.
 */
export function toggleFoundrySidebar(options: SidebarAccessOptions): boolean {
  const sidebar = options.getUi()?.sidebar;
  if (sidebar?.toggleExpanded === undefined) {
    return false;
  }
  void sidebar.toggleExpanded(sidebar.expanded !== true);
  return true;
}
