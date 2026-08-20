---
'tongs-browser': patch
---

The bar's collapsed state is written back to settings and read at startup, and now a test says so.

`onCollapsedChanged` was once typed on the options with nothing joining it to the settings store, so
the state was applied at startup and then silently forgotten. Changing a default is not finished when
the value changes; it is finished when the value survives a reload.

The bar reporting a change was already covered. What was not covered is `main.ts` writing that report
to the store and reading it back on the next launch, which is exactly the half that went missing.
Deleting either direction now fails a test.

`main.ts` 83.3% to 86.1% statements and 40% to 50% of functions; the project reaches 95.6%.
