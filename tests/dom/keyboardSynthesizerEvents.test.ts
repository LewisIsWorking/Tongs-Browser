import { beforeEach, describe, expect, it } from 'vitest';

import { recorded, startRecording, synthesizer } from './support/keyboardRecording.js';

beforeEach(() => {
  startRecording();
});

describe('KeyboardSynthesizer event shape', () => {
  /**
   * The field that decides whether any of this works. Foundry's keybinding system is code based
   * throughout, so an event carrying only key is invisible to it no matter how correct it otherwise
   * looks.
   */
  it('sets code, which is what Foundry matches keybindings on', () => {
    synthesizer(null).press({
      code: 'ShiftLeft',
      key: 'Shift',
      keyCode: 16,
      label: 'Shift',
      sticky: true,
    });

    expect(recorded[0]).toMatchObject({ type: 'keydown', code: 'ShiftLeft', key: 'Shift' });
  });

  it('also sets the deprecated keyCode and which, which older modules still read', () => {
    synthesizer(null).press({
      code: 'Delete',
      key: 'Delete',
      keyCode: 46,
      label: 'Del',
      sticky: false,
    });

    expect(recorded[0]?.keyCode).toBe(46);
  });

  it('reflects held modifiers as flags on the event itself', () => {
    const subject = synthesizer(null);
    subject.press({ code: 'ShiftLeft', key: 'Shift', keyCode: 16, label: 'Shift', sticky: true });
    recorded.length = 0;
    subject.press({ code: 'Delete', key: 'Delete', keyCode: 46, label: 'Del', sticky: false });

    expect(recorded[0]).toMatchObject({ code: 'Delete', shiftKey: true, ctrlKey: false });
  });

  it('reports the key being pressed as held on its own keydown', () => {
    synthesizer(null).press({
      code: 'ControlLeft',
      key: 'Control',
      keyCode: 17,
      label: 'Ctrl',
      sticky: true,
    });

    expect(recorded[0]?.ctrlKey).toBe(true);
  });

  it('reports the key as released on its own keyup', () => {
    const subject = synthesizer(null);
    const definition = {
      code: 'ControlLeft',
      key: 'Control',
      keyCode: 17,
      label: 'Ctrl',
      sticky: true,
    };
    subject.press(definition);
    recorded.length = 0;
    subject.release(definition);

    expect(recorded[0]).toMatchObject({ type: 'keyup', ctrlKey: false });
  });

  it('sends a full press and release on a tap', () => {
    synthesizer(null).tap({
      code: 'Escape',
      key: 'Escape',
      keyCode: 27,
      label: 'Esc',
      sticky: false,
    });

    expect(recorded.map((entry) => entry.type)).toEqual(['keydown', 'keyup']);
  });
});

/**
 * The module's biggest open risk, and genuinely unknowable without a running Foundry. If Foundry
 * declines to update its internal held key set from an untrusted event, every synthesised modifier
 * is invisible however correctly the event is built, and the whole feature is dead. So the strategy
 * is measured rather than assumed.
 */
