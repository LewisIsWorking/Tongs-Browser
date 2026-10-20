/**
 * Which of the variant rules a new player meets are on in this world. Added 2026-10-20.
 *
 * Lewis, 2026-10-20: "We should build more of the dual class macro into the player onboarding experience".
 * The welcome offers two classes, and the checklist adds a step, only for a rule that is on.
 *
 * ⚠️ Dual Class and Ancestry Paragon are PF2e Workbench's settings, not the system's (PF2e has no Dual
 *    Class setting, see `dualclass/README.md`). Free Archetype is the system's own, under `pf2e` or `sf2e`.
 * ⛔ Reading a setting nobody registered THROWS in Foundry, so a world without Workbench reads as off.
 */
export const WORKBENCH = 'xdy-pf2e-workbench';

export interface VariantRules {
  readonly dualClass: boolean;
  readonly ancestryParagon: boolean;
  readonly freeArchetype: boolean;
}

export interface RuleSettings {
  get(namespace: string, key: string): unknown;
}

/** True only for a registered setting that is exactly `true`; anything else, a throw included, is off. */
export function ruleOn(
  settings: RuleSettings | undefined,
  namespace: string,
  key: string
): boolean {
  try {
    return settings?.get(namespace, key) === true;
  } catch {
    return false;
  }
}

export function variantRules(
  settings: RuleSettings | undefined,
  systemId: string | undefined
): VariantRules {
  const system = systemId ?? 'pf2e';
  return {
    dualClass: ruleOn(settings, WORKBENCH, 'legacyVariantRuleDualClass'),
    ancestryParagon: ruleOn(settings, WORKBENCH, 'legacyVariantRuleAncestryParagon'),
    freeArchetype:
      (system === 'pf2e' || system === 'sf2e') && ruleOn(settings, system, 'freeArchetypeVariant'),
  };
}
