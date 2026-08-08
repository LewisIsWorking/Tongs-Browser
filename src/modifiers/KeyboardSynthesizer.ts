import type { Logger } from '../core/Logger.js';
import type { KeyDefinition } from './keyDefinitions.js';

/**
 * Minimal view of Foundry's KeyboardManager. Both members are optional because whether they exist,
 * and under these names, is exactly what the probe is there to find out.
 */
export interface KeyboardManagerLike {
  downKeys?: Set<string>;
  isModifierActive?: (modifier: string) => boolean;
}

/**
 * How held keys are communicated to Foundry.
 *
 * 'events' means synthesised KeyboardEvents are honoured and nothing further is needed.
 * 'direct' means they are not, and the internal set has to be written to as well.
 * 'unknown' means the probe could not run, usually because Foundry is not present.
 */
export type KeyboardStrategy = 'events' | 'direct' | 'unknown';

export interface KeyboardSynthesizerOptions {
  readonly document: Document;
  /** Returns Foundry's keyboard manager, or null when unavailable. */
  readonly getKeyboardManager: () => KeyboardManagerLike | null;
  readonly logger?: Logger;
}

/**
 * Dispatches keyboard events for the modifier bar, and works around Foundry not believing them.
 *
 * This is the module's biggest open risk, and it is genuinely unknowable without a running Foundry.
 * The problem: Foundry's KeyboardManager keeps its own set of held keys, and a great deal of core
 * and PF2e code asks that set rather than reading the event it was handed. If Foundry declines to
 * update the set from an untrusted event, every synthesised modifier is invisible no matter how
 * correctly the event is constructed, and the whole modifier feature is dead.
 *
 * Rather than guess, the strategy is measured once at startup: press a key, look in the set, and
 * decide. When events are honoured nothing else happens. When they are not, the set is written to
 * directly, with a loud warning, because reaching into another package's internals is a real cost
 * and should be visible rather than silent.
 */
export class KeyboardSynthesizer {
  private strategy: KeyboardStrategy = 'unknown';
  private readonly held = new Set<string>();

  public constructor(private readonly options: KeyboardSynthesizerOptions) {}

  public getStrategy(): KeyboardStrategy {
    return this.strategy;
  }

  public getHeldCodes(): ReadonlySet<string> {
    return this.held;
  }

  /**
   * Determines how this Foundry build treats synthesised keyboard events.
   *
   * Probes with ShiftLeft specifically: it is a modifier, so a stray press has no side effect on
   * its own, unlike Escape which would close an application or Delete which would remove a token.
   * The probe cleans up after itself either way.
   */
  public probe(): KeyboardStrategy {
    const manager = this.options.getKeyboardManager();
    if (manager?.downKeys === undefined) {
      this.strategy = 'unknown';
      this.options.logger?.warn(
        'Foundry keyboard manager not available, modifier keys will rely on events alone.'
      );
      return this.strategy;
    }

    const probeCode = 'ShiftLeft';
    const alreadyHeld = manager.downKeys.has(probeCode);
    if (alreadyHeld) {
      // The user is genuinely holding shift on a physical keyboard. Probing now would tell us
      // nothing, so defer rather than produce a false positive.
      this.strategy = 'unknown';
      return this.strategy;
    }

    this.dispatch('keydown', {
      code: probeCode,
      key: 'Shift',
      keyCode: 16,
      label: 'Shift',
      sticky: true,
    });

    const honoured = manager.downKeys.has(probeCode);

    this.dispatch('keyup', {
      code: probeCode,
      key: 'Shift',
      keyCode: 16,
      label: 'Shift',
      sticky: true,
    });
    manager.downKeys.delete(probeCode);

    this.strategy = honoured ? 'events' : 'direct';

    if (honoured) {
      this.options.logger?.info('Foundry honours synthesised keyboard events.');
    } else {
      this.options.logger?.warn(
        'Foundry ignored a synthesised keyboard event, most likely because it is not trusted. ' +
          'Falling back to writing the keyboard manager down keys set directly. This reaches into ' +
          'Foundry internals and may break on a future version.'
      );
    }

    return this.strategy;
  }

  public press(definition: KeyDefinition): void {
    this.held.add(definition.code);
    this.dispatch('keydown', definition);
    this.applyDirectFallback(definition.code, true);
  }

  public release(definition: KeyDefinition): void {
    this.held.delete(definition.code);
    this.dispatch('keyup', definition);
    this.applyDirectFallback(definition.code, false);
  }

  /** Full press and release, for the momentary keys. */
  public tap(definition: KeyDefinition): void {
    this.press(definition);
    this.release(definition);
  }

  /** Releases everything, for when the bar is hidden or the module is switched off. */
  public releaseAll(definitions: readonly KeyDefinition[]): void {
    for (const definition of definitions) {
      if (this.held.has(definition.code)) {
        this.release(definition);
      }
    }
  }

  private applyDirectFallback(code: string, held: boolean): void {
    if (this.strategy !== 'direct') {
      return;
    }
    const downKeys = this.options.getKeyboardManager()?.downKeys;
    if (downKeys === undefined) {
      return;
    }
    if (held) {
      downKeys.add(code);
    } else {
      downKeys.delete(code);
    }
  }

  /**
   * Dispatched on the document rather than on the focused element, because Foundry binds its
   * keyboard handling at the window and document level and a focused button would swallow it.
   */
  private dispatch(type: 'keydown' | 'keyup', definition: KeyDefinition): void {
    const event = new KeyboardEvent(type, {
      code: definition.code,
      key: definition.key,
      bubbles: true,
      cancelable: true,
      composed: true,
      /*
       * Held modifiers are reflected as flags on the event too, or a listener reading event.shiftKey
       * during a ctrl press would see the wrong picture. press adds to the held set before
       * dispatching and release removes before dispatching, so the key being changed reports its
       * own new state correctly without needing a special case.
       */
      ctrlKey: this.held.has('ControlLeft'),
      shiftKey: this.held.has('ShiftLeft'),
      altKey: this.held.has('AltLeft'),
      metaKey: false,
    });

    // keyCode and which are deprecated and read only on the interface, so they are defined onto the
    // instance after construction. Plenty of older module code still reads them.
    Object.defineProperty(event, 'keyCode', { value: definition.keyCode });
    Object.defineProperty(event, 'which', { value: definition.keyCode });

    this.options.document.dispatchEvent(event);
  }
}
