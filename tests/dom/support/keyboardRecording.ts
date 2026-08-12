import { expect } from 'vitest';

import {
  KeyboardSynthesizer,
  type KeyboardManagerLike,
} from '../../../src/modifiers/KeyboardSynthesizer.js';
import { ModifierBar } from '../../../src/modifiers/ModifierBar.js';
import type { ModifierFlags } from '../../../src/pointer/ModifierFlags.js';

/**
 * Recording the keyboard events the synthesizer produces. Extracted from modifierBar.test
 * 2026-08-12, when that file reached 825 lines.
 *
 * Shared rather than copied, because every suite that touches a modifier key needs exactly this and
 * five copies of a listener that appends to a module level array is five chances for one of them to
 * forget to reset it between tests.
 */
export interface Recorded {
  readonly type: string;
  readonly code: string;
  readonly key: string;
  readonly keyCode: number;
  readonly ctrlKey: boolean;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
}

export const recorded: Recorded[] = [];

export function record(event: KeyboardEvent): void {
  recorded.push({
    type: event.type,
    code: event.code,
    key: event.key,
    // Deprecated on purpose. The synthesizer sets keyCode precisely because plenty of older module
    // code in the Foundry ecosystem still reads it, so the test has to read it too.
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    keyCode: event.keyCode,
    ctrlKey: event.ctrlKey,
    shiftKey: event.shiftKey,
    altKey: event.altKey,
  });
}

/** Call from a `beforeEach`. Clears the page, the recording, and re-attaches the listeners. */
export function startRecording(): void {
  document.body.innerHTML = '';
  recorded.length = 0;
  document.addEventListener('keydown', record);
  document.addEventListener('keyup', record);
}

export function synthesizer(manager: KeyboardManagerLike | null): KeyboardSynthesizer {
  return new KeyboardSynthesizer({ document, getKeyboardManager: () => manager });
}

/** Nothing reached the document, which is what a swallowed key looks like. */
export function expectNoKeys(): void {
  expect(recorded).toHaveLength(0);
}

/** An attached bar, with the flags it has reported so far. */
export function createBar(): { bar: ModifierBar; flags: ModifierFlags[] } {
  const flags: ModifierFlags[] = [];
  const bar = new ModifierBar({
    document,
    synthesizer: synthesizer(null),
    onFlagsChanged: (next) => flags.push(next),
  });
  bar.attach();
  return { bar, flags };
}

/** ⚠️ Throws rather than returning null: a missing key is a broken bar, not an empty assertion. */
export function keyButton(bar: ModifierBar, code: string): HTMLButtonElement {
  const button = bar.getElement().querySelector<HTMLButtonElement>(`[data-code="${code}"]`);
  if (button === null) {
    throw new Error(`No button for ${code}`);
  }
  return button;
}
