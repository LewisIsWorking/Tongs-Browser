# packs-src

The JSON sources of the compendium packs Tongs ships. Added 2026-11-03.

Lewis looked for "Take a Breather (No-Limit Stamina)" in the Compendium tab and it was not there: Tongs only
made it in the world's Macro Directory. So it ships in a pack too, beside that world copy.

| Folder / file                                | What it is                                                    |
| -------------------------------------------- | ------------------------------------------------------------- |
| `tongs-macros/take-a-breather-no-limit.json` | The "Tongs Macros" pack's one macro, calling the module `api` |

## How it is built

`npm run build:packs` (and `npm run build`, which runs it) compiles each folder here into a Foundry LevelDB
pack under `packs/`, with `@foundryvtt/foundryvtt-cli`'s `compilePack`. `packs/` is build output, never
committed, and goes into module.zip beside `dist/`.

- ⚠️ **The command must stay the world macro's**: `tests/unit/breatherPack.test.ts` holds it equal to
  `BREATHER_COMMAND` in `src/breather/breatherMacro.ts`. It only calls
  `game.modules.get('tongs-browser').api.takeABreatherNoLimit()`, so the pack copy never goes stale.
- ⚠️ **Each document needs `_key`** (`!macros!<_id>`): LevelDB packs are keyed by it.
- ⚠️ **module.json names the pack** (`packs`, with `ownership` PLAYER OBSERVER), or Foundry never shows it.
