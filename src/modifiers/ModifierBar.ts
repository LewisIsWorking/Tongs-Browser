import type { KeyboardSynthesizer } from './KeyboardSynthesizer.js';
import {
  ALL_OFF,
  KeyLatch,
  diff,
  toModifierFlags,
  toggle,
  type KeyLatchValue,
  type ModifierCode,
  type ModifierLatchMap,
} from './ModifierState.js';
import { MODIFIER_KEYS, MOMENTARY_KEYS, type KeyDefinition } from './keyDefinitions.js';
import type { ModifierFlags } from '../pointer/ModifierFlags.js';
import { ActionButtons } from './ActionButtons.js';
import { clampBarPosition } from './BarClamp.js';
import type { BarPosition } from './BarPosition.js';
import { BarDragHandle } from './BarDragHandle.js';
import type { TrayAction } from './TrayAction.js';

// Re-exported so every existing importer of ModifierBar keeps working unchanged.
export type { BarPosition };

export interface ModifierBarOptions {
  readonly document: Document;
  readonly synthesizer: KeyboardSynthesizer;
  /** Called whenever the held modifiers change, so the pointer can carry the new flags. */
  readonly onFlagsChanged: (flags: ModifierFlags) => void;
  readonly initialPosition?: BarPosition;
  readonly onPositionChanged?: (position: BarPosition) => void;
  readonly initialCollapsed?: boolean;
  readonly onCollapsedChanged?: (collapsed: boolean) => void;
  /**
   * The width the bar is allowed to occupy, which is not always the width of the window.
   *
   * Injected rather than read from the DOM here, so the clamp stays testable without a layout
   * engine and so this component keeps knowing nothing about Foundry's markup. Defaults to the
   * whole window, which is the right answer when nothing is in the way.
   */
  readonly getAvailableWidth?: () => number;
  /** Utility buttons shown on the bar itself, kept visible even when the keys are collapsed. */
  readonly trayActions?: readonly TrayAction[];
}

// Re-exported so every existing importer of ModifierBar keeps working unchanged.
export type { TrayAction };

const LATCH_CLASS: Readonly<Record<KeyLatchValue, string>> = {
  [KeyLatch.OFF]: 'tb-key--off',
  [KeyLatch.LATCHED]: 'tb-key--latched',
  [KeyLatch.LOCKED]: 'tb-key--locked',
};

/**
 * Where the bar sits before anyone drags it. Changed 2026-08-09.
 *
 * ⚠️ It used to be x 16, which put it straight on top of Foundry's scene controls. Measured on a
 * live 14.365: the scene control toolbar occupies x 12 to 66 down the whole left edge, and the bar
 * is 54px tall starting at y 120, so it covered the toolbar between y 120 and 174. The module's own
 * enable and disable toggle, which lives in that toolbar, sat at x 42 to 66 and y 132 to 156,
 * entirely underneath the bar. elementFromPoint at the toggle's centre returned the bar's collapse
 * button.
 *
 * That is the worst possible thing to cover. The scene control toggle exists precisely so there is
 * a way to switch the module off when the pointer is misbehaving, and it was unreachable by a real
 * finger from the moment the bar appeared.
 *
 * 88 clears the toolbar with room to spare on any viewport wide enough for Foundry to run at all,
 * which is at least 1366px. The position is remembered once dragged, so this only ever decides the
 * first launch.
 */
const DEFAULT_POSITION: BarPosition = { x: 88, y: 120 };

/**
 * The floating modifier key bar.
 *
 * Rendered into body rather than Foundry's #interface, because that subtree is torn down and
 * rebuilt constantly as applications render. A bar living inside it would vanish mid session.
 *
 * The bar binds its own pointerdown handlers and marks itself with the ignore attribute, so the
 * gesture layer leaves it alone entirely. Driving the bar through the virtual pointer would be
 * circular: you would need a modifier held to press the key that holds the modifier.
 */
export class ModifierBar {
  private readonly root: HTMLDivElement;
  private readonly keysContainer: HTMLDivElement;
  private readonly buttons = new Map<string, HTMLButtonElement>();
  private readonly actions = new ActionButtons();
  private latches: ModifierLatchMap = ALL_OFF;
  private position: BarPosition;
  private collapsed: boolean;
  private attached = false;

  /** Dragging the bar around. See modifiers/BarDragHandle.ts. */
  private readonly dragHandle = new BarDragHandle({
    getPosition: () => this.position,
    setPosition: (position) => {
      this.setPosition(position);
    },
  });

  public constructor(private readonly options: ModifierBarOptions) {
    this.position = options.initialPosition ?? DEFAULT_POSITION;
    this.collapsed = options.initialCollapsed ?? false;

    const doc = options.document;
    this.root = doc.createElement('div');
    this.root.className = 'tb-modifier-bar';
    // Tells the gesture layer to keep away. Without this, tapping a key would be routed through the
    // virtual pointer, which is exactly the thing the key is meant to modify.
    this.root.setAttribute('data-tongs-browser', 'ignore');

    const handle = doc.createElement('div');
    handle.className = 'tb-modifier-bar__handle';
    handle.title = 'Drag to move';
    handle.addEventListener('pointerdown', this.dragHandle.onPointerDown);
    handle.addEventListener('pointermove', this.dragHandle.onPointerMove);
    handle.addEventListener('pointerup', this.dragHandle.onPointerUp);
    handle.addEventListener('pointercancel', this.dragHandle.onPointerUp);
    this.root.append(handle);

    const collapseButton = doc.createElement('button');
    collapseButton.type = 'button';
    collapseButton.className = 'tb-modifier-bar__collapse';
    collapseButton.textContent = '<';
    collapseButton.setAttribute('aria-label', 'Collapse modifier bar');
    collapseButton.addEventListener('click', () => {
      this.setCollapsed(!this.collapsed);
    });
    this.root.append(collapseButton);

    this.actions.build(doc, this.root, options.trayActions ?? [], () => {
      this.refreshActions();
    });

    this.keysContainer = doc.createElement('div');
    this.keysContainer.className = 'tb-modifier-bar__keys';
    this.root.append(this.keysContainer);

    for (const definition of MODIFIER_KEYS) {
      this.keysContainer.append(this.createStickyButton(definition));
    }
    for (const definition of MOMENTARY_KEYS) {
      this.keysContainer.append(this.createMomentaryButton(definition));
    }

    this.applyPosition();
    this.applyCollapsed();
    this.render();
    this.refreshActions();
  }

  public attach(): void {
    if (this.attached) {
      return;
    }
    this.options.document.body.append(this.root);
    this.attached = true;

    /*
     * Clamp AFTER the bar is in the document, which is the first moment it has a size.
     *
     * The constructor also clamps, and cannot possibly succeed: an element that is not in the DOM
     * reports offsetWidth 0, every position fits inside a width of zero, and the clamp is a no op by
     * construction. So the clamp existed and only ever ran on a drag. Measured on a 412px phone the
     * bar still opened across the sidebar, because opening is not dragging.
     *
     * Reading offsetWidth here forces layout, so the size is real by the time it is used.
     */
    this.applyPosition();

    // A rotation or a sidebar that expands changes the room available, and a position that fitted
    // a moment ago can be off screen or over the sidebar now.
    this.options.document.defaultView?.addEventListener('resize', this.onViewportChanged);
  }

  public detach(): void {
    if (!this.attached) {
      return;
    }
    // Release anything held before disappearing, or Foundry is left believing shift is down with
    // no visible way for the user to clear it.
    this.clearAll();
    this.options.document.defaultView?.removeEventListener('resize', this.onViewportChanged);
    this.root.remove();
    this.attached = false;
  }

  /**
   * Bring every stateful action button in line with what it controls.
   *
   * Public because the state can change without anyone tapping the button: another user pausing the
   * game, or a drag ending on its own. Callers hook whatever tells them and call this.
   *
   * aria-pressed as well as the class, because the visual state is the whole point and a button that
   * only looks pressed is invisible to anyone not looking at it.
   */
  public refreshActions(): void {
    this.actions.refresh();
  }

  /** Re-clamp against whatever room there is now. Public so a caller can prompt it after a re-render. */
  public reclamp(): void {
    if (this.attached) {
      this.applyPosition();
    }
  }

  private readonly onViewportChanged = (): void => {
    this.applyPosition();
  };

  public isAttached(): boolean {
    return this.attached;
  }

  public getElement(): HTMLDivElement {
    return this.root;
  }

  public getLatches(): ModifierLatchMap {
    return this.latches;
  }

  public getPosition(): BarPosition {
    return this.position;
  }

  public isCollapsed(): boolean {
    return this.collapsed;
  }

  public getFlags(): ModifierFlags {
    return toModifierFlags(this.latches);
  }

  public setPosition(position: BarPosition): void {
    this.position = position;
    this.applyPosition();
    this.options.onPositionChanged?.(position);
  }

  public setCollapsed(collapsed: boolean): void {
    this.collapsed = collapsed;
    this.applyCollapsed();
    this.options.onCollapsedChanged?.(collapsed);
  }

  /** Releases every held modifier and returns the bar to a clean state. */
  public clearAll(): void {
    const next = ALL_OFF;
    this.applyLatches(next);
  }

  private createStickyButton(definition: KeyDefinition): HTMLButtonElement {
    const button = this.options.document.createElement('button');
    button.type = 'button';
    button.className = 'tb-key tb-key--sticky';
    button.dataset['code'] = definition.code;
    button.textContent = definition.label;
    button.addEventListener('click', () => {
      this.applyLatches(toggle(this.latches, definition.code as ModifierCode));
    });
    this.buttons.set(definition.code, button);
    return button;
  }

  private createMomentaryButton(definition: KeyDefinition): HTMLButtonElement {
    const button = this.options.document.createElement('button');
    button.type = 'button';
    button.className = 'tb-key tb-key--momentary';
    button.dataset['code'] = definition.code;
    button.textContent = definition.label;
    button.addEventListener('click', () => {
      /*
       * A full press and release on tap. These keys carry whatever modifiers are currently latched,
       * which is what makes combinations reachable: latch Ctrl, then tap Delete.
       */
      this.options.synthesizer.tap(definition);
      this.consumeLatchedAfterAction();
    });
    this.buttons.set(definition.code, button);
    return button;
  }

  /**
   * Applies a new latch map, dispatching only the keys that actually changed.
   *
   * Diffing rather than replaying everything matters: re-pressing an already held key would send a
   * duplicate keydown, and Foundry treats a repeated keydown as auto repeat.
   */
  private applyLatches(next: ModifierLatchMap): void {
    const changes = diff(this.latches, next);
    this.latches = next;

    for (const change of changes) {
      const definition = MODIFIER_KEYS.find((candidate) => candidate.code === change.code);
      if (definition === undefined) {
        continue;
      }
      if (change.held) {
        this.options.synthesizer.press(definition);
      } else {
        this.options.synthesizer.release(definition);
      }
    }

    this.render();
    this.options.onFlagsChanged(this.getFlags());
  }

  /**
   * Clears latched keys after a momentary key has used them, leaving locked ones held. This is what
   * makes LATCHED mean "for the next action only".
   */
  private consumeLatchedAfterAction(): void {
    const next: Record<ModifierCode, KeyLatchValue> = { ...this.latches };
    let changed = false;
    for (const definition of MODIFIER_KEYS) {
      const code = definition.code as ModifierCode;
      if (this.latches[code] === KeyLatch.LATCHED) {
        next[code] = KeyLatch.OFF;
        changed = true;
      }
    }
    if (changed) {
      this.applyLatches(Object.freeze(next));
    }
  }

  private render(): void {
    for (const definition of MODIFIER_KEYS) {
      const button = this.buttons.get(definition.code);
      if (button === undefined) {
        continue;
      }
      const latch = this.latches[definition.code as ModifierCode];
      button.classList.remove(...Object.values(LATCH_CLASS));
      button.classList.add(LATCH_CLASS[latch]);
      button.setAttribute('aria-pressed', latch === KeyLatch.OFF ? 'false' : 'true');
      // The three states must be distinguishable without relying on colour alone.
      button.dataset['latch'] = latch;
    }
  }

  /**
   * Place the bar, keeping it fully on screen.
   *
   * There was no clamping here at all, and on a phone that is not a cosmetic problem. Measured
   * 2026-08-10 on a 412px wide Android viewport: the bar rendered from x 88 to x 532, leaving Esc,
   * Enter and Tab off the right edge with no way to reach them. The CSS wrap keeps the bar narrow
   * enough to fit; this keeps it positioned somewhere it can be seen, including after a drag toward
   * an edge and after a rotation that makes the viewport smaller than it was when the position was
   * saved.
   *
   * Measured, not assumed: the size is read back from the laid out element rather than computed from
   * the key count, because the bar wraps and its height therefore depends on the viewport width.
   * Clamping to a remembered width would reintroduce the same class of bug the wrap just fixed.
   *
   * The lower bound is 0 rather than a margin, so that a viewport genuinely narrower than the bar
   * shows its left edge rather than centring the overflow and cutting off both sides.
   *
   * The clamp is written back to this.position rather than applied only to the style. Clamping just
   * the rendered position would leave the two disagreeing, and onHandlePointerDown builds its drag
   * offset from this.position, so the next grab would jump the bar by exactly the difference. A
   * remembered position that no longer fits is worth less than a drag that behaves.
   */
  private applyPosition(): void {
    /*
     * The arithmetic lives in BarClamp, where it can be tested. jsdom reports offsetWidth as 0 for
     * everything, so the DOM suite around this bar clamps a zero sized element every time and cannot
     * reach a single interesting case.
     */
    const clamped = clampBarPosition({
      desired: this.position,
      barWidth: this.root.offsetWidth,
      barHeight: this.root.offsetHeight,
      availableWidth: this.options.getAvailableWidth?.(),
      viewport: { width: window.innerWidth, height: window.innerHeight },
    });

    this.position = clamped.position;
    this.root.style.left = `${String(this.position.x)}px`;
    this.root.style.top = `${String(this.position.y)}px`;
    this.root.style.maxWidth = `${String(clamped.maxWidth)}px`;
  }

  private applyCollapsed(): void {
    this.root.classList.toggle('tb-modifier-bar--collapsed', this.collapsed);
    this.keysContainer.style.display = this.collapsed ? 'none' : '';
  }
}
