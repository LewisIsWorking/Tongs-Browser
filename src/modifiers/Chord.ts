import type { KeyDefinition } from './keyDefinitions.js';

/**
 * Sending a modifier plus a key as one action. Added 2026-09-07.
 *
 * ⛔ WHY A CHORD IS ITS OWN THING. The bar can already do "latch Ctrl, then tap Delete", and that is
 * the right shape for a modifier the user is CHOOSING. It is the wrong shape for a command that is
 * always the same chord: nobody thinks of undo as "control, then Z", they think of it as undo, and
 * making them assemble it from two controls is asking them to know a keyboard they do not have.
 *
 * ⚠️ Its own module rather than a method on `KeyboardSynthesizer`, which sits at 189 of the 200 line
 * limit. The size rule says extract rather than trim, and this genuinely is a separate idea: the
 * synthesizer knows how to send ONE key, and this knows that some commands are more than one.
 *
 * ⚠️ Takes the three calls it needs rather than the whole synthesizer, so a test drives it with three
 * functions and no keyboard, and so it cannot quietly start depending on the rest.
 */
export interface ChordPorts {
  readonly press: (definition: KeyDefinition) => void;
  readonly release: (definition: KeyDefinition) => void;
  readonly tap: (definition: KeyDefinition) => void;
}

/**
 * Hold the modifiers, tap the key, let go.
 *
 * ⚠️ ORDER IS THE WHOLE CONTRACT, and it is the part a test must assert as a sequence rather than as
 * a set. The modifiers have to be down BEFORE the key's keydown goes out, because that keydown is
 * what carries `ctrlKey` and what Foundry reads its own held-key set against. Tapping first and
 * holding after sends a bare key, which for undo means whatever plain Z is bound to.
 *
 * ⚠️ Released in REVERSE, so a two modifier chord unwinds the way a hand would. Nothing depends on
 * it today with a single modifier, and it costs one word to be right if a second is ever added.
 */
export function sendChord(
  ports: ChordPorts,
  modifiers: readonly KeyDefinition[],
  key: KeyDefinition
): void {
  for (const modifier of modifiers) {
    ports.press(modifier);
  }

  ports.tap(key);

  for (const modifier of [...modifiers].reverse()) {
    ports.release(modifier);
  }
}
