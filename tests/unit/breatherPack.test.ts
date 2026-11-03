import { existsSync, readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { BREATHER_COMMAND } from '../../src/breather/breatherMacro.js';
import { BREATHER_TITLE } from '../../src/breather/takeABreather.js';

/**
 * The "Tongs Macros" compendium, 2026-11-03: Lewis looked for the breather macro in the Compendium tab
 * and it was only in the Macro Directory. The pack ships it too, calling the same module `api`.
 */
interface PackEntry {
  readonly name?: string;
  readonly label?: string;
  readonly path?: string;
  readonly type?: string;
  readonly ownership?: Record<string, string>;
}

const manifest = JSON.parse(readFileSync('module.json', 'utf8')) as { packs?: PackEntry[] };
const pack = manifest.packs?.find((entry) => entry.name === 'tongs-macros');
const SOURCE = 'packs-src/tongs-macros/take-a-breather-no-limit.json';

describe('the Tongs Macros compendium', () => {
  it('is declared in module.json as a Macro pack players can see', () => {
    expect(pack).toMatchObject({
      label: 'Tongs Macros',
      path: 'packs/tongs-macros',
      type: 'Macro',
      ownership: { PLAYER: 'OBSERVER', ASSISTANT: 'OWNER' },
    });
  });

  it('has its source folder in the repository', () => {
    expect(existsSync('packs-src/tongs-macros')).toBe(true);
  });

  it('ships Take a Breather (No-Limit Stamina), running the world macro command', () => {
    expect(existsSync(SOURCE)).toBe(true);
    const macro = JSON.parse(readFileSync(SOURCE, 'utf8')) as Record<string, unknown>;
    expect(macro).toMatchObject({
      name: BREATHER_TITLE,
      type: 'script',
      command: BREATHER_COMMAND,
      ownership: { default: 1 },
    });
    expect(macro['command']).toContain("game.modules.get('tongs-browser')");
    expect(macro['command']).toContain('takeABreatherNoLimit()');
    expect(macro['_key']).toBe(`!macros!${String(macro['_id'])}`);
    expect(String(macro['_id'])).toMatch(/^[A-Za-z0-9]{16}$/);
  });
});
