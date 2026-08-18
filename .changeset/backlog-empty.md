---
'tongs-browser': patch
---

Every source folder is now documented: 26 of 26, backlog empty.

The last seven are `src`, `scripts`, `tests/unit`, `tests/dom`, `tests/browser`, and the two
`support/` folders. Each names its own files, so the guard accepts them, and each records why the
folder is arranged the way it is rather than listing what is in it: why the composition root is
separate from the parts, why flags go through `node` rather than `npm run ... --`, what jsdom can and
cannot tell you, and why shared fixtures have their adoption enforced.

The backlog mechanism stays in place. It can only shrink, so a new folder cannot be born onto it, and
`node scripts/check-folder-readmes.ts` now reports `0 still on the backlog` rather than a count that
needed working through.
