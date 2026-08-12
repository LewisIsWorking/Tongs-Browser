import { toModifierFlags, type ModifierLatchMap } from './ModifierState.js';
import type { ModifierFlags } from '../pointer/ModifierFlags.js';
import { ActionButtons } from './ActionButtons.js';
import { clampBarPosition } from './BarClamp.js';
import { DEFAULT_POSITION, type BarPosition } from './BarPosition.js';
import { BarAttachment } from './BarAttachment.js';
import { buildBarChrome } from './BarChrome.js';
import { BarDragHandle } from './BarDragHandle.js';
import { KeyButtons } from './KeyButtons.js';
import type { ModifierBarOptions } from './ModifierBarOptions.js';
import type { TrayAction } from './TrayAction.js';

// Re-exported so every existing importer of ModifierBar keeps working unchanged.
export type { BarPosition };

// Re-exported so every existing importer of ModifierBar keeps working unchanged.
export type { ModifierBarOptions, TrayAction };

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
  private readonly actions = new ActionButtons();
  /**
   * The modifier keys, their latch state and their rendering. See modifiers/KeyButtons.ts.
   *
   * ⚠️ Assigned in the CONSTRUCTOR BODY, not as a field initialiser. Field initialisers run before
   * the constructor's parameter properties are assigned, so reading `this.options` from one gets
   * undefined. TypeScript catches this exact case; the equivalent in the drag handle happens to be
   * safe only because it reads `this.options` lazily from inside a closure.
   */
  private readonly keys: KeyButtons;
  private position: BarPosition;
  private collapsed: boolean;
  private readonly attachment: BarAttachment;

  /** Dragging the bar around. See modifiers/BarDragHandle.ts. */
  private readonly dragHandle = new BarDragHandle({
    getPosition: () => this.position,
    setPosition: (position) => {
      this.setPosition(position);
    },
  });

  public constructor(private readonly options: ModifierBarOptions) {
    this.keys = new KeyButtons({
      document: options.document,
      synthesizer: options.synthesizer,
      onLatchesChanged: () => {
        options.onFlagsChanged(this.getFlags());
      },
    });
    this.position = options.initialPosition ?? DEFAULT_POSITION;
    this.collapsed = options.initialCollapsed ?? false;

    const doc = options.document;
    const chrome = buildBarChrome(doc, {
      onHandlePointerDown: this.dragHandle.onPointerDown,
      onHandlePointerMove: this.dragHandle.onPointerMove,
      onHandlePointerUp: this.dragHandle.onPointerUp,
      onCollapseToggled: () => {
        this.setCollapsed(!this.collapsed);
      },
    });
    this.root = chrome.root;

    this.actions.build(doc, this.root, options.trayActions ?? [], () => {
      this.refreshActions();
    });

    this.keysContainer = chrome.keysContainer;
    this.keysContainer.className = 'tb-modifier-bar__keys';
    this.root.append(this.keysContainer);

    this.keys.build(this.keysContainer);

    this.attachment = new BarAttachment({
      document: doc,
      element: this.root,
      onLayoutAvailable: () => {
        this.applyPosition();
      },
      onDetaching: () => {
        this.clearAll();
      },
    });

    this.applyPosition();
    this.applyCollapsed();
    this.refreshActions();
  }

  public attach(): void {
    this.attachment.attach();
  }

  public detach(): void {
    this.attachment.detach();
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
    this.attachment.reclamp();
  }

  public isAttached(): boolean {
    return this.attachment.isAttached();
  }

  public getElement(): HTMLDivElement {
    return this.root;
  }

  public getLatches(): ModifierLatchMap {
    return this.keys.getLatches();
  }

  public getPosition(): BarPosition {
    return this.position;
  }

  public isCollapsed(): boolean {
    return this.collapsed;
  }

  public getFlags(): ModifierFlags {
    return toModifierFlags(this.keys.getLatches());
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
    this.keys.clearAll();
  }

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
