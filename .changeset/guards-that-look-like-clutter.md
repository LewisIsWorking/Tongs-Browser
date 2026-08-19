---
'tongs-browser': patch
---

`FoundryAccess` was 54% covered, and the uncovered half was the whole point of the file.

Every method opens with `typeof x === 'undefined'`, and its docblock claims that is not redundant with
the declared type: a global Foundry has never defined throws a **ReferenceError** on plain access, and
an optional chain does not help, because the reference itself is what throws.

That claim is now proven rather than asserted. Replacing the guard with the tidier-looking
`game?.keyboard ?? null` turns a test red with exactly the predicted
`ReferenceError: game is not defined`. Without that, the guards read as defensive clutter and the
obvious tidy-up compiles, looks cleaner, and throws anywhere Foundry has not booted.

The tests `delete` the globals rather than setting them to undefined, because those are different
states: a declared-but-undefined global is safe to reference, an undeclared one throws, and only the
second reproduces what the guards exist for.

`FoundryAccess.ts` 54% to 100% statements, `src/foundry` to 90.3%, the project 92.3% to 92.6%.
