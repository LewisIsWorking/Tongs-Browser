import { describe, expect, it } from 'vitest';

import {
  UPRIGHT_ROTATION,
  facingChange,
  missingScale,
  newActorFacing,
  uprightRotation,
} from '../../src/facing/tokenFacing.js';

/**
 * Default token facing, 2026-11-14: every new token mirrored both ways and free to rotate, placed at 180
 * so the art shows upright.
 */
describe("a prototype token's facing", () => {
  it('mirrors both axes, keeps the size, and unlocks rotation', () => {
    expect(facingChange({ texture: { scaleX: 0.8, scaleY: 0.8 }, lockRotation: true })).toEqual({
      texture: { scaleX: -0.8, scaleY: -0.8 },
      lockRotation: false,
    });
  });

  it('reads a missing scale as 1', () => {
    expect(facingChange({})).toEqual({ texture: { scaleX: -1, scaleY: -1 }, lockRotation: false });
    expect(facingChange(undefined)).toEqual({
      texture: { scaleX: -1, scaleY: -1 },
      lockRotation: false,
    });
  });

  it('finishes a half-done one: mirrored one way, or mirrored but locked', () => {
    expect(facingChange({ texture: { scaleX: -1, scaleY: 1 }, lockRotation: false })).toEqual({
      texture: { scaleX: -1, scaleY: -1 },
      lockRotation: false,
    });
    expect(facingChange({ texture: { scaleX: -2, scaleY: -2 }, lockRotation: true })).toEqual({
      texture: { scaleX: -2, scaleY: -2 },
      lockRotation: false,
    });
  });

  it('is left alone when it already faces the default way', () => {
    expect(facingChange({ texture: { scaleX: -1, scaleY: -1 }, lockRotation: false })).toBeNull();
  });
});

describe("a new actor's facing", () => {
  const pf2eDefault = { texture: { scaleX: 1, scaleY: 1 }, lockRotation: true };

  it('is the default facing when its creator asked for no mirror', () => {
    expect(newActorFacing(undefined, pf2eDefault)).toEqual({
      texture: { scaleX: -1, scaleY: -1 },
      lockRotation: false,
    });
    expect(newActorFacing({ texture: { scaleX: 1, scaleY: 1 } }, pf2eDefault)).not.toBeNull();
  });

  it("keeps a creator's own mirror, on either axis", () => {
    expect(newActorFacing({ texture: { scaleX: -1 } }, pf2eDefault)).toBeNull();
    expect(newActorFacing({ texture: { scaleY: -0.5 } }, pf2eDefault)).toBeNull();
  });
});

describe("a new token's rotation", () => {
  it('is upright, 180, for art mirrored both ways at rotation 0 or none', () => {
    expect(uprightRotation({ texture: { scaleX: -1, scaleY: -1 }, rotation: 0 })).toBe(180);
    expect(uprightRotation({ texture: { scaleX: -0.8, scaleY: -0.8 } })).toBe(UPRIGHT_ROTATION);
  });

  it('is left alone when the art is not mirrored both ways', () => {
    expect(uprightRotation({ texture: { scaleX: -1, scaleY: 1 }, rotation: 0 })).toBeNull();
    expect(uprightRotation({ texture: { scaleX: 1, scaleY: -1 } })).toBeNull();
    expect(uprightRotation({})).toBeNull();
  });

  it('is left alone when it was already turned', () => {
    expect(uprightRotation({ texture: { scaleX: -1, scaleY: -1 }, rotation: 90 })).toBeNull();
  });
});

describe('the scale a locked Scale slider left out of the Prototype Token form', () => {
  it('is the saved size, so the Mirror ticks survive', () => {
    expect(missingScale({ mirrorX: true, mirrorY: true }, -0.8)).toBe(0.8);
    expect(missingScale({ mirrorX: false }, 1.5)).toBe(1.5);
    expect(missingScale({ mirrorY: true }, undefined)).toBe(1);
  });

  it('is nothing when the form sent a scale, as it will once PF2e or core fixes this', () => {
    expect(missingScale({ scale: 1, mirrorX: true, mirrorY: true }, 2)).toBeNull();
  });

  it('is nothing when the form sent no Mirror ticks either', () => {
    expect(missingScale({ name: 'Goblin' }, 1)).toBeNull();
  });
});
