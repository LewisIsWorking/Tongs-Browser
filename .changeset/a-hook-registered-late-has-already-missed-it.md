---
'tongs-browser': patch
---

Test binding and unbinding the scene control, which the injection suite never exercised.

The existing suite calls `inject` directly, so every question about the button's content was answered
and none about whether it is ever asked for. Foundry builds the scene controls exactly once, so a
hook registered late has already missed the only call it will get: measured on 14.365, a listener
added at `ready` fired zero times and the button never existed.

Unbinding is asserted by id as well as hook name, because passing the wrong id silently leaves the
listener installed. Mutation checked: all five mutations kill a test.

`SceneControlToggle` reaches 100% of statements, functions and lines; project coverage to 97.57
statements and 96.88 functions.
