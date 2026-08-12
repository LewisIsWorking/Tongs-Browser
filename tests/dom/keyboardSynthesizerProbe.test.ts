import { beforeEach, describe, expect, it } from 'vitest';

import type { KeyboardManagerLike } from '../../src/modifiers/KeyboardSynthesizer.js';
import { record, startRecording, synthesizer } from './support/keyboardRecording.js';

beforeEach(() => {
  startRecording();
});

describe('KeyboardSynthesizer isTrusted probe', () => {
  it('reports events when Foundry honours a synthesised keydown', () => {
    const downKeys = new Set<string>();
    document.addEventListener('keydown', (event) => {
      downKeys.add(event.code);
    });
    const manager: KeyboardManagerLike = { downKeys };

    expect(synthesizer(manager).probe()).toBe('events');
  });

  it('reports direct when Foundry ignores the synthesised keydown', () => {
    const manager: KeyboardManagerLike = { downKeys: new Set<string>() };
    expect(synthesizer(manager).probe()).toBe('direct');
  });

  it('reports unknown when the keyboard manager is absent entirely', () => {
    expect(synthesizer(null).probe()).toBe('unknown');
  });

  it('leaves no trace of the probe key behind', () => {
    const manager: KeyboardManagerLike = { downKeys: new Set<string>() };
    const subject = synthesizer(manager);
    subject.probe();

    expect(manager.downKeys?.has('ShiftLeft')).toBe(false);
    expect(subject.getHeldCodes().has('ShiftLeft')).toBe(false);
  });

  /**
   * Probing while the user genuinely holds shift on a physical keyboard would read the real key as
   * proof that synthesis works, and a false positive here disables the fallback silently.
   */
  it('declines to probe while the user is really holding the probe key', () => {
    const manager: KeyboardManagerLike = { downKeys: new Set<string>(['ShiftLeft']) };
    expect(synthesizer(manager).probe()).toBe('unknown');
  });

  it('writes the down keys set directly once the direct strategy is chosen', () => {
    const manager: KeyboardManagerLike = { downKeys: new Set<string>() };
    const subject = synthesizer(manager);
    subject.probe();
    expect(subject.getStrategy()).toBe('direct');

    subject.press({ code: 'AltLeft', key: 'Alt', keyCode: 18, label: 'Alt', sticky: true });
    expect(manager.downKeys?.has('AltLeft')).toBe(true);

    subject.release({ code: 'AltLeft', key: 'Alt', keyCode: 18, label: 'Alt', sticky: true });
    expect(manager.downKeys?.has('AltLeft')).toBe(false);
  });

  it('does not touch the set when events are honoured, leaving Foundry to manage it', () => {
    const downKeys = new Set<string>();
    document.addEventListener('keydown', (event) => {
      downKeys.add(event.code);
    });
    const manager: KeyboardManagerLike = { downKeys };
    const subject = synthesizer(manager);
    subject.probe();
    expect(subject.getStrategy()).toBe('events');

    downKeys.clear();
    document.removeEventListener('keydown', record);
    subject.press({ code: 'AltLeft', key: 'Alt', keyCode: 18, label: 'Alt', sticky: true });

    // Present only because the listener above added it, not because the synthesizer wrote it.
    expect(downKeys.has('AltLeft')).toBe(true);
  });
});
