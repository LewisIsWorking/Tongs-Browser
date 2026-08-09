# 5. Both interaction surfaces accept the virtual pointer, measured on 14.365

Date: 2026-08-09

Status: Accepted

## Context

[ADR 0003](0003-pointerevent-vs-mouseevent.md) established that Foundry has two interaction surfaces
which fail independently: ordinary DOM chrome, and a WebGL canvas where PIXI does its own hit
testing. It set out what to dispatch. It could not check that anything accepted it, because there was
no Foundry to check against.

[ADR 0004](0004-foundry-honours-synthetic-keyboard-events.md) then settled the keyboard half of the
trust question and, more usefully, established the method: drive a real Foundry headlessly and
measure rather than reason.

The pointer half remained open, and it is the more dangerous one. A pointer that drives the chrome
and not the canvas produces the module's worst failure mode: the interface works, the board does not,
and nothing appears in the console either way. Every automated test in this repo runs against jsdom
or a hand written stub, neither of which contains PIXI.

## Measurement

`npm run check:foundry`, 2026-08-09, Foundry 14.365, world `cootestworld` on `coo` 0.60.1, headless
Chrome. All six checks passed.

| Check                                             | Result                                            |
| ------------------------------------------------- | ------------------------------------------------- |
| Module enabled, `api.isEnabled()`                 | true                                              |
| Overlays attached                                 | `cursor=1 bar=1 keys=8`                           |
| Cursor never hit testable, on real layout         | 3 sample points, all resolved to Foundry elements |
| **Foundry chrome accepts a synthesised click**    | sidebar tab `chat -> combat`                      |
| **PIXI canvas tracks a synthesised pointer move** | `{x:1180,y:1300} -> {x:1820,y:1700}`              |
| No page errors from the module                    | none                                              |

The two that matter are asserted against Foundry's own state, not against appearances:

- **Chrome.** The click is judged by `ui.sidebar.tabGroups.primary`, which is Foundry's own record of
  the active tab. A CSS class check would pass on a tab that merely looks selected.
- **Canvas.** The move is judged by `canvas.mousePosition`, Foundry's translated copy of where PIXI
  believes the pointer is. If that tracks, the whole canvas interaction path accepted the event.

The canvas assertion is a **change** between two positions rather than an expected coordinate. The
scene to screen transform depends on zoom and padding, so a hardcoded number would test the
arithmetic in the check rather than test Foundry.

## Consequences

**Both surfaces work.** The central risk that ADR 0003 was written to manage is measured, not
assumed, on this build.

**The cursor property holds against real layout.** It was already unit tested, but only against a
stub. Foundry stacks a great many positioned elements, and a failure here would send every click to
the cursor itself.

**What this still does not cover**, and should not be read as covering:

- ~~Touch input. The check drives `VirtualPointer` directly through the module API, bypassing
  `TouchBinder` and the gesture state machine. Those are covered by unit tests, and by nothing that
  has ever seen a real finger.~~ **Closed the same day by
  [ADR 0006](0006-real-touch-input-drives-the-gesture-machine.md)**, which injects trusted single
  finger touch through CDP. Multi touch remains uncovered.
- Hover semantics beyond position tracking. A moving `canvas.mousePosition` is not proof that a token
  nameplate appears or that a PF2e HUD panel opens. Those are still device checklist items.
- Android. Everything here is desktop Chrome.

**The world is written to.** The canvas check needs a scene and a world may legitimately have none,
so it creates one prefixed `[probe]` and deletes it in a `finally`. Cleanup was verified by searching
the world database afterwards, not merely assumed from the absence of an error.
