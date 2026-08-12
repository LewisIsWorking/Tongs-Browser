---
'tongs-browser': patch
---

Extract `foundry/FoundryAccess.ts` and `TrayWiring.ts`. **`TongsBrowser.ts` drops from 422 to 314.**
742 tests green.

**`FoundryAccess`** collects every reach for a Foundry global into one place, and records why each one
opens the way it does:

> ⚠️ **The `typeof` guard is NOT redundant with the declared type.** A global Foundry has never
> defined at all throws a `ReferenceError` on plain access, and `typeof` is the only way to survive
> it. An optional chain does not help, because the reference ITSELF is what throws.

The arithmetic behind those answers already lives in `CanvasReaders` and `AvailableWidth`, tested
without a browser. This is the impure half, collected so the rest can stay pure.

**`TrayWiring`** connects the tray buttons to what they drive, and pins one hazard:

> ⚠️ **The pointer arrives as a THUNK rather than a reference.** The tray is built while the modifier
> bar is being constructed, which happens before the pointer field has been assigned. Taking the
> pointer eagerly captures `undefined`, and every tray button that touches it fails at the first tap,
> long after the code that caused it has finished running.

That is the same class as the `KeyButtons` field initialiser caught earlier today: a constructor
reading something that is not assigned yet, where the symptom appears far from the cause.
