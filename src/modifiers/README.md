# src/modifiers

The floating bar: sticky modifier keys, the tray actions, and the furniture that carries them.

| File                     | What it is                                          |
| ------------------------ | --------------------------------------------------- |
| `ModifierBar.ts`         | The bar itself, assembled from the pieces below     |
| `ModifierBarOptions.ts`  | What a caller may configure                         |
| `BarChrome.ts`           | The frame, the drag handle, the collapse control    |
| `BarDragHandle.ts`       | Moving the bar around the screen                    |
| `BarPosition.ts`         | Where it sits, and remembering that                 |
| `BarClamp.ts`            | Keeping it on screen when the viewport changes      |
| `BarAttachment.ts`       | Getting it into the document and out again          |
| `BarDefaults.ts`         | The defaults, including whether it starts collapsed |
| `KeyButtons.ts`          | Shift, Ctrl, Alt as latching buttons                |
| `keyDefinitions.ts`      | Which keys exist, as data                           |
| `ModifierState.ts`       | Which are currently held                            |
| `KeyboardSynthesizer.ts` | Making Foundry believe a key is down                |
| `ActionButtons.ts`       | Grab, drop, and the rest of the tray                |
| `TrayAction.ts`          | One tray action described as data                   |

## The question this folder's existence depends on

Does Foundry honour a **synthesised** `KeyboardEvent`? `isTrusted` is `false` for anything we
dispatch, and if `KeyboardManager` checked it the whole bar would be decorative.

`KeyboardSynthesizer.ts` measures this at startup rather than assuming, and `main.ts` logs the answer
at `ready`:

```
Tongs Browser | Ready. Keyboard strategy: events | direct | unknown
```

- **`events`** means synthesised events are honoured. The bar works as designed. Measured on 14.365
  and re-confirmed on **14.366**, so the fallback below is dead code.
- **`direct`** means they are not, and the synthesizer writes `KeyboardManager.downKeys` itself.
  Functional, version-fragile, and it logs a loud warning saying so.
- **`unknown`** is the worst outcome and hides two causes: `downKeys` was missing entirely, or Shift
  was genuinely held during the probe. Evaluate `game.keyboard?.downKeys` to tell them apart.

## A latched control must say the next action

A sticky Shift that looks identical whether it is armed or not is a control whose effect is invisible
by construction. The key buttons show their latched state, and the tray's grab and drop are separate
labels rather than one toggle, so the button always names what pressing it will do.

## The bar is furniture, and furniture gets in the way

Two measured bugs live here, and they pull in opposite directions:

- Real `pointerup` from a finger on our own tray must **not** reach PIXI, because PIXI listens at the
  window and maps by coordinate, and `#handlePointerUp` ends in `#handleDragCancel`. That is what
  makes tapping **drop** work at all.
- The bar's own **drag handle** must keep its native events, or the bar cannot be moved. Reported as
  "I can't move the tongs toolbox now" after the suppression above was added.

`BarChrome.ts` marks the handle with `data-tongs-native-pointer`, which is the narrow hole in the
suppression. Tray buttons stay suppressed.
