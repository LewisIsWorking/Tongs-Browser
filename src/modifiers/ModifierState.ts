import type { ModifierFlags } from '../pointer/ModifierFlags.js';

/**
 * Sticky modifier keys, modelled as an explicit tri-state rather than a boolean.
 *
 * OFF and LATCHED are obvious. LOCKED exists because the two useful behaviours conflict: a modifier
 * that clears after one use is right for a single shift click, and a modifier that stays held is
 * right for rotating a token through several drags. A boolean forces a choice between them, so
 * there are three states and the user picks per key with a second tap.
 */
export const KeyLatch = {
  OFF: 'OFF',
  /** Held for the next action, then released automatically. */
  LATCHED: 'LATCHED',
  /** Held until tapped again. Survives use. */
  LOCKED: 'LOCKED',
} as const;

export type KeyLatchValue = (typeof KeyLatch)[keyof typeof KeyLatch];

/** The three sticky modifiers, keyed by the KeyboardEvent.code Foundry actually reads. */
export const MODIFIER_CODES = ['ControlLeft', 'ShiftLeft', 'AltLeft'] as const;

export type ModifierCode = (typeof MODIFIER_CODES)[number];

export type ModifierLatchMap = Readonly<Record<ModifierCode, KeyLatchValue>>;

export const ALL_OFF: ModifierLatchMap = Object.freeze({
  ControlLeft: KeyLatch.OFF,
  ShiftLeft: KeyLatch.OFF,
  AltLeft: KeyLatch.OFF,
});

/**
 * Advances one key through the cycle.
 *
 * OFF to LATCHED to LOCKED to OFF. Reaching LOCKED by tapping twice matches the brief's "double tap
 * to lock" without needing a separate double tap detector on the bar, since two taps in a row land
 * there naturally.
 */
export function cycle(latch: KeyLatchValue): KeyLatchValue {
  switch (latch) {
    case KeyLatch.OFF:
      return KeyLatch.LATCHED;
    case KeyLatch.LATCHED:
      return KeyLatch.LOCKED;
    case KeyLatch.LOCKED:
      return KeyLatch.OFF;
  }
}

export function isHeld(latch: KeyLatchValue): boolean {
  return latch !== KeyLatch.OFF;
}

export function toggle(map: ModifierLatchMap, code: ModifierCode): ModifierLatchMap {
  return Object.freeze({ ...map, [code]: cycle(map[code]) });
}

export function release(map: ModifierLatchMap, code: ModifierCode): ModifierLatchMap {
  return Object.freeze({ ...map, [code]: KeyLatch.OFF });
}

/**
 * Clears every LATCHED key, leaving LOCKED ones held. Called after an action consumes the
 * modifiers, which is what makes latched mean "for the next thing only".
 */
export function consumeLatched(map: ModifierLatchMap): ModifierLatchMap {
  const next: Record<ModifierCode, KeyLatchValue> = { ...map };
  for (const code of MODIFIER_CODES) {
    if (map[code] === KeyLatch.LATCHED) {
      next[code] = KeyLatch.OFF;
    }
  }
  return Object.freeze(next);
}

export function clearAll(): ModifierLatchMap {
  return ALL_OFF;
}

export function anyHeld(map: ModifierLatchMap): boolean {
  return MODIFIER_CODES.some((code) => isHeld(map[code]));
}

/** Which codes changed between two maps, and whether each is now held. */
export function diff(
  previous: ModifierLatchMap,
  next: ModifierLatchMap
): { code: ModifierCode; held: boolean }[] {
  const changes: { code: ModifierCode; held: boolean }[] = [];
  for (const code of MODIFIER_CODES) {
    const wasHeld = isHeld(previous[code]);
    const nowHeld = isHeld(next[code]);
    if (wasHeld !== nowHeld) {
      changes.push({ code, held: nowHeld });
    }
  }
  return changes;
}

/** Projects the latch map onto the flags carried by every synthesised pointer event. */
export function toModifierFlags(map: ModifierLatchMap): ModifierFlags {
  return Object.freeze({
    ctrlKey: isHeld(map.ControlLeft),
    shiftKey: isHeld(map.ShiftLeft),
    altKey: isHeld(map.AltLeft),
    metaKey: false,
  });
}
