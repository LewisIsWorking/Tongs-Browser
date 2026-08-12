import type { TrayAction } from './TrayAction.js';

/**
 * The bar's utility buttons: building them, grouping them, and keeping them truthful. Extracted from
 * ModifierBar 2026-08-12.
 *
 * ⚠️ These sit OUTSIDE the keys container on purpose, so they survive the bar being collapsed.
 * Collapsing hides the modifier keys, which is the point of collapsing, but an action like "show the
 * sidebar" is most needed exactly when the bar has been shrunk out of the way.
 */
export class ActionButtons {
  private readonly buttons = new Map<string, HTMLButtonElement>();
  private readonly stateful = new Map<string, () => boolean>();
  private readonly dynamicLabels = new Map<string, () => string>();

  /**
   * Build every button and attach it under `root`.
   *
   * Grouped buttons go into a shared container so related controls cluster rather than wrap apart:
   * four pan arrows split across a line break stop reading as a d-pad and become four unrelated
   * arrows.
   */
  public build(
    doc: Document,
    root: HTMLElement,
    actions: readonly TrayAction[],
    onActivated: () => void
  ): void {
    const groups = new Map<string, HTMLDivElement>();

    for (const action of actions) {
      const button = doc.createElement('button');
      button.type = 'button';
      button.className = 'tb-modifier-bar__action';
      button.textContent = action.label;
      button.title = action.title;
      button.setAttribute('aria-label', action.title);
      button.dataset['action'] = action.id;
      button.addEventListener('click', () => {
        action.activate();
        // Refresh immediately, so a button that reports state is never a tap behind the truth.
        onActivated();
      });

      if (action.group === undefined) {
        root.append(button);
      } else {
        let container = groups.get(action.group);
        if (container === undefined) {
          container = doc.createElement('div');
          container.className = `tb-modifier-bar__group tb-modifier-bar__group--${action.group}`;
          root.append(container);
          groups.set(action.group, container);
        }
        container.append(button);
      }

      this.buttons.set(action.id, button);
      if (action.isActive !== undefined) {
        this.stateful.set(action.id, action.isActive);
      }
      if (action.getLabel !== undefined) {
        this.dynamicLabels.set(action.id, action.getLabel);
      }
    }
  }

  /**
   * Bring every button back in line with what it controls.
   *
   * ⚠️ The LABEL is refreshed as well as the latch, and that is not decoration. A latched button whose
   * label never changes cost a whole round of device diagnostics: the gold styling says "on", but
   * "on" does not tell you the next thing to do is tap it OFF. The grab button held a token and
   * showed the same open hand whether it was holding one or idle, and a report came back mid drag
   * with the token quite correctly sitting where it started, because Foundry only commits on the drop.
   */
  public refresh(): void {
    for (const [id, getLabel] of this.dynamicLabels) {
      const button = this.buttons.get(id);
      if (button !== undefined) {
        button.textContent = getLabel();
      }
    }

    for (const [id, isActive] of this.stateful) {
      const button = this.buttons.get(id);
      if (button === undefined) {
        continue;
      }
      const active = isActive();
      button.classList.toggle('tb-modifier-bar__action--on', active);
      /*
       * `aria-pressed` as well as the class, because a latch that is only a colour is invisible to a
       * screen reader and to anyone who cannot tell this particular gold from this particular grey.
       */
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    }
  }

  public get(id: string): HTMLButtonElement | undefined {
    return this.buttons.get(id);
  }
}
