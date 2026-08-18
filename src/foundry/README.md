# src/foundry

Everything that reaches into Foundry. Kept in one folder so the surface the module depends on is a
list you can read, rather than something discovered by grepping for `game.` when a version bumps.

| File                     | What it is                                                |
| ------------------------ | --------------------------------------------------------- |
| `FoundryAccess.ts`       | Reading Foundry's globals, defensively                    |
| `FoundryActions.ts`      | Doing things to Foundry: control, pan, open               |
| `CanvasReaders.ts`       | Board size, grid, stage transform                         |
| `CharacterSheet.ts`      | Opening an actor's sheet                                  |
| `SidebarAccess.ts`       | Finding the sidebar and its tabs                          |
| `SidebarMenu.ts`         | The sidebar's own controls                                |
| `AvailableWidth.ts`      | How much room the interface actually has                  |
| `PauseControl.ts`        | The pause toggle                                          |
| `LongPressGuard.ts`      | Stopping Foundry's long press from firing during our drag |
| `BuildLongPressGuard.ts` | Wiring that guard to the pointer                          |

## Why the dependency surface is a folder

The module survives Foundry upgrades better than it has any right to, and this is why: when 14.366
changed things, the search space was ten files rather than the whole codebase. A rename here is a
compile error rather than a silent `undefined` at runtime three screens away.

## The long press guard

Foundry starts its own long-press timer on `pointerdown` and fires `#handleLongPress` after
`LONG_PRESS_DURATION_MS`. Our grab gesture holds a press deliberately, so without a guard the user's
own hold triggers Foundry's long press in the middle of the drag we are trying to start.

⚠️ The guard must be armed **after** the sequence is dispatched, not before: it is the `pointerdown`
that arms Foundry's timer, so arming first guards a timer that does not exist yet and then lets the
real one through.

## What we know about the interaction manager

Foundry decides single versus double click in `MouseInteractionManager`, keyed on `lcTime` and the
distance from the last click, and it will not dispatch at all unless its state is between `HOVER` and
`DRAG`. That state machine is the reason so much here is about making Foundry believe a real pointer
is present, rather than about calling methods directly.

Calling the handlers directly is possible and is the wrong instinct: it skips the permission checks
(`can("clickLeft2", …)`) and the state transitions, so it proves the handler works while telling you
nothing about whether a user could ever reach it. See issue #243 for a case where that distinction is
the entire question.
