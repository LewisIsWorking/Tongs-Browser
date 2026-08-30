---
'tongs-browser': patch
---

Fix the update path, which could never have fired.

The manifest's `manifest` field pointed at `raw.githubusercontent.com/.../main/module.json`. Foundry
polls that URL and compares its `version` against the installed one, and the copy on `main` is
deliberately left at the `0.1.0` placeholder because only the copy inside `module.zip` is stamped.
Every install since v0.2.1 has therefore polled a file that says `0.1.0` and concluded there was
nothing newer.

Measured 2026-08-22 against the live URLs: the shipped zip reported `0.25.67`, its own manifest URL
reported `0.1.0`.

- `manifest` now points at `releases/latest/download/module.json`.
- The release workflow attaches the stamped `module.json` as an asset, in both the release job and
  the manual attach job. Without that asset the new URL would 404.
- `stamp-manifest.ts` refuses to stamp a manifest whose poll URL points at an unstamped source.
- The README's install URL pointed at the same placeholder file, and its status line claimed the
  module had never been run against a real Foundry instance, which stopped being true on 2026-08-20.
