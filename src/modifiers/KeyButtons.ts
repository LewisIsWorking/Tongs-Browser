import type { KeyboardSynthesizer } from './KeyboardSynthesizer.js';
import {
  ALL_OFF,
  diff,
  KeyLatch,
  toggle,
  type KeyLatchValue,
  type ModifierCode,
  type ModifierLatchMap,
} from './ModifierState.js';
import { MODIFIER_KEYS, MOMENTARY_KEYS, type KeyDefinition } from './keyDefinitions.js';

/**
 * The modifier keys themselves: their buttons, their latch state, and keeping the two in step.
 * Extracted from ModifierBar 2026-08-12.
 *
 * A key here has THREE states rather than two, which is the whole design. Off, latched for the next
 * action only, and locked until tapped off. Sticky keys are how a one finger user reaches
 * shift-click and ctrl-click at all, and two states would force a choice between "cannot chord" and
 * "silently still held ten minutes later".
 */
const LATCH_CLASS: Readonly<Record<KeyLatchValue, string>> = {
  [KeyLatch.OFF]: 'tb-key--off',
  [KeyLatch.LATCHED]: 'tb-key--latched',
  [KeyLatch.LOCKED]: 'tb-key--locked',
};

export interface KeyButtonsOptions {
  readonly document: Document;
  readonly synthesizer: KeyboardSynthesizer;
  /** Called after any change, so the bar can tell the pointer which modifiers it now carries. */
  readonly onLatchesChanged: () => void;
}

export class KeyButtons {
  private readonly buttons = new Map<string, HTMLButtonElement>();
  private latches: ModifierLatchMap = ALL_OFF;

  public constructor(private readonly options: KeyButtonsOptions) {}

  /** Build every key into the container, sticky modifiers first and momentary keys after. */
  public build(container: HTMLElement): void {
    for (const definition of MODIFIER_KEYS) {
      container.append(this.createSticky(definition));
    }
    for (const definition of MOMENTARY_KEYS) {
      container.append(this.createMomentary(definition));
    }
    // Paint the initial state, so a freshly built key already shows its latch rather than waiting
    // for the first change to tell it what it is.
    this.render();
  }

  public getLatches(): ModifierLatchMap {
    return this.latches;
  }

  /** Releases every held modifier and returns the keys to a clean state. */
  public clearAll(): void {
    this.apply(ALL_OFF);
  }

  public get(code: string): HTMLButtonElement | undefined {
    return this.buttons.get(code);
  }

  private createSticky(definition: KeyDefinition): HTMLButtonElement {
    const button = this.options.document.createElement('button');
    button.type = 'button';
    button.className = 'tb-key tb-key--sticky';
    button.dataset['code'] = definition.code;
    button.textContent = definition.label;
    button.addEventListener('click', () => {
      this.apply(toggle(this.latches, definition.code as ModifierCode));
    });
    this.buttons.set(definition.code, button);
    return button;
  }

  private createMomentary(definition: KeyDefinition): HTMLButtonElement {
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
      this.consumeLatched();
    });
    this.buttons.set(definition.code, button);
    return button;
  }

  /**
   * Applies a new latch map, dispatching only the keys that actually CHANGED.
   *
   * ⚠️ Diffing rather than replaying everything. Re-pressing an already held key sends a duplicate
   * keydown, and Foundry treats a repeated keydown as auto repeat, so a held Shift would arrive as a
   * stream of repeats rather than one press.
   */
  private apply(next: ModifierLatchMap): void {
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
    this.options.onLatchesChanged();
  }

  /**
   * Clears LATCHED keys after a momentary key has used them, leaving LOCKED ones held. This is what
   * makes latched mean "for the next action only", and locked mean "until I say otherwise".
   */
  private consumeLatched(): void {
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
      this.apply(Object.freeze(next));
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
      /*
       * ⚠️ `data-latch` as well as the class, because the THREE states must be distinguishable
       * without relying on colour alone. `aria-pressed` is a boolean and cannot say which of latched
       * or locked a key is in, and those differ in exactly the thing the user needs to predict: one
       * survives the next action and one does not.
       */
      button.dataset['latch'] = latch;
    }
  }
}
