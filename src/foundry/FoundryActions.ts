import { openCharacterSheet, type SheetOwner } from './CharacterSheet.js';
import {
  applyPause,
  decidePauseAction,
  isDesignatedGm,
  type FoundryGame,
  type GameAccess,
} from './PauseControl.js';
import {
  decideSidebarAction,
  popOutSidebarTab,
  toggleFoundrySidebar as runSidebarAction,
  type FoundryUi,
  type SidebarAccessOptions,
} from './SidebarAccess.js';
import { logger } from '../core/Logger.js';

/**
 * The macro a GM can write to define what pausing means in their world.
 *
 * By NAME rather than by id, so a GM can create it after the module is installed and it starts
 * working without anything being reconfigured.
 */
const PAUSE_MACRO_NAME = 'Tongs Pause';

/**
 * What the tray buttons actually do to Foundry. Extracted from TongsBrowser 2026-08-12.
 *
 * Every decision here lives in a module of its own, already tested; this is the layer that reaches
 * for the globals and carries the decision out. Keeping it apart from the composition root means the
 * root wires things together and nothing else, and it means the reaching-for-globals is in one place
 * rather than scattered through a class that also builds a pointer.
 */
export interface FoundryActionsPort {
  readonly document: Document;
  /** Ask the designated GM to pause, for a player whose own toggle cannot reach anyone else. */
  readonly requestPauseFromGm: () => void;
}

export class FoundryActions {
  /** The sidebar picker, while it is open. */
  private sidebarMenu: HTMLDivElement | null = null;

  public constructor(private readonly options: FoundryActionsPort) {}

  /**
   * Pause or unpause the game.
   *
   * A macro is tried FIRST, by name, exactly as asked for: a GM can write "Tongs Pause", give every
   * player ownership of it, and this button will run it. That keeps the behaviour in the world's
   * hands rather than hard coded here.
   *
   * ⚠️ Being straight about the limit, because it is not obvious and macro ownership looks like it
   * should solve it: a macro cannot give a player the ability to pause the WORLD. Foundry's
   * Game#togglePause only emits the socket message `if (options.broadcast && game.user.isGM)`, so a
   * player running any macro toggles their own client and nobody else's. The check is on the emit
   * path, not on macro permissions. Genuinely letting players pause needs a GM side relay, which is
   * a separate piece of work.
   *
   * So: macro if there is one, otherwise Foundry's own toggle, which broadcasts for a GM and is
   * local for everyone else.
   */
  public togglePause(): void {
    const action = decidePauseAction(this.gameAccess(), PAUSE_MACRO_NAME);
    if (action.kind === 'runMacro') {
      void action.execute();
      return;
    }
    if (action.kind === 'relay') {
      this.options.requestPauseFromGm();
    }
  }

  /** Foundry's game object, injected rather than reached for, so the decisions stay testable. */
  public gameAccess(): GameAccess {
    return { getGame: () => (globalThis as { game?: FoundryGame }).game };
  }

  /**
   * A picker listing every sidebar tab, built from our own DOM.
   *
   * Foundry's own tab strip is 27px wide on a phone, which is what made the sidebar unreachable in
   * the first place, so reusing it to choose a tab would inherit exactly the problem being solved.
   * These are 44px rows in an element this module controls, marked with the ignore attribute so the
   * gesture layer routes taps straight to them rather than through the virtual pointer.
   */
  public openSidebarMenu(tabNames: readonly string[]): void {
    const doc = this.options.document;
    const menu = doc.createElement('div');
    menu.className = 'tb-sidebar-menu';
    menu.setAttribute('data-tongs-browser', 'ignore');

    for (const name of tabNames) {
      const item = doc.createElement('button');
      item.type = 'button';
      item.className = 'tb-sidebar-menu__item';
      item.dataset['tab'] = name;
      // Foundry's tab names are already lower case single words, so this is all the label needed.
      item.textContent = name.charAt(0).toUpperCase() + name.slice(1);
      item.addEventListener('click', () => {
        this.closeSidebarMenu();
        this.popOutSidebarTab(name);
      });
      menu.append(item);
    }

    doc.body.append(menu);
    this.sidebarMenu = menu;
  }

  public closeSidebarMenu(): void {
    this.sidebarMenu?.remove();
    this.sidebarMenu = null;
  }

  /** The tabs this user can open, and popping one out. Both live in foundry/SidebarAccess.ts. */
  public sidebarAccess(): SidebarAccessOptions {
    return {
      getUi: () => (globalThis as { ui?: FoundryUi }).ui,
      isGm: () =>
        (globalThis as { game?: { user?: { isGM?: boolean } } }).game?.user?.isGM === true,
    };
  }

  public popOutSidebarTab(name: string): void {
    popOutSidebarTab(this.sidebarAccess(), name);
  }

  /**
   * Whether this client is the ONE GM that should act on a relayed request.
   *
   * `game.users.activeGM` is Foundry's own designated user: it picks the same single GM on every
   * client, deterministically. Using "am I a GM" instead would have every connected GM answer the
   * same request, flipping the pause state once per GM and landing wherever the race ended.
   */
  public isDesignatedGm(): boolean {
    return isDesignatedGm(this.gameAccess());
  }

  public applyPause(pause: boolean): void {
    applyPause(this.gameAccess(), pause);
  }

  /**
   * Open the sheet for whichever actor this user is playing.
   *
   * Three sources, in the order that matches what someone means by "my character". The assigned
   * character first, since that is what the user explicitly nominated. Then a controlled token,
   * because on a phone selecting a token then asking for its sheet is the natural flow and double
   * tapping a token is fiddly. Then the only actor they own, which covers the common case of a
   * player with exactly one character and no assignment set.
   *
   * Deliberately system agnostic. PF2e and SF2e were the worlds this was asked for, but every system
   * renders sheets through the same Actor#sheet, so naming one would only make it break on the next.
   */
  public openCharacterSheet(): void {
    const opened = openCharacterSheet({
      assigned: () =>
        (globalThis as { game?: { user?: { character?: SheetOwner | null } } }).game?.user
          ?.character,
      controlled: () =>
        (globalThis as { canvas?: { tokens?: { controlled?: { actor?: SheetOwner }[] } } }).canvas
          ?.tokens?.controlled?.[0]?.actor,
      allActors: () => [
        ...((globalThis as { game?: { actors?: Iterable<SheetOwner> } }).game?.actors ?? []),
      ],
    });

    if (!opened) {
      logger.warn(
        'No character to open. Assign one in your user configuration, or select a token.'
      );
    }
  }

  /**
   * Act on what the sidebar button should do.
   *
   * The DECISION lives in foundry/SidebarAccess.ts, where it is testable without a DOM and where
   * the two measured lessons behind its ordering are recorded. This only carries it out.
   */
  public toggleFoundrySidebar(): void {
    const action = decideSidebarAction(this.sidebarAccess(), this.sidebarMenu !== null);

    switch (action.kind) {
      case 'closeMenu':
        this.closeSidebarMenu();
        return;
      case 'openMenu':
        this.openSidebarMenu(action.tabNames);
        return;
      case 'togglePopout':
        this.popOutSidebarTab(action.tabName);
        return;
      case 'toggleDocked':
        runSidebarAction(this.sidebarAccess());
        return;
      case 'nothing':
        return;
    }
  }
}
