# src/settings

Foundry's settings, and the scene control that turns the module on.

| File                    | What it is                                  |
| ----------------------- | ------------------------------------------- |
| `SettingDefinitions.ts` | Every setting the module registers          |
| `SettingShapes.ts`      | The four shapes a setting value can take    |
| `ApplySetting.ts`       | Turning a changed setting into an effect    |
| `SettingsStore.ts`      | Reading and writing through Foundry's store |
| `SceneControlToggle.ts` | The hand icon in the token controls         |

## The switch is exhaustive on purpose

`ApplySetting.ts` switches over the setting key union with no `default` branch. That is deliberate:
adding a setting to `SettingDefinitions.ts` without teaching `ApplySetting` what to do about it
becomes a **compile error**, rather than a setting that saves, displays, reads back correctly, and
does nothing.

That failure is easy to ship and very hard to see, because every part of it works except the part
nobody is looking at.

`SettingShapes.ts` is imported back by `SettingDefinitions.ts` as a **type only**, so the two can
describe each other without a runtime cycle.

## Registered is not the same as reachable

A scene control has to be in the tool group _and_ rendered _and_ not covered by something else. The
live check asserts all three separately, because a toggle that is registered but invisible looks
exactly like a toggle that does not exist, and a toggle sitting under the modifier bar looks exactly
like one that ignores taps.

## A default is a decision, and it has to persist

`onCollapsedChanged` was typed and never wired, so the bar's collapsed state was applied at startup
and then silently forgotten. Changing a default is not finished when the value changes; it is
finished when the value survives a reload.
