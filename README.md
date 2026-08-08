# Tongs Browser

A Foundry VTT module that makes Foundry genuinely usable on an Android phone or tablet.

Foundry assumes a mouse. Touch devices do not have one, and the gap is wider than it first looks:

- **Hover states never fire.** Tooltips, token nameplates and the PF2e HUD panels all have no touch
  equivalent, so they are simply dead.
- **Small targets are guesswork**, because your fingertip covers the thing you are aiming at.
- **Modifier held actions are unreachable.** Shift drag to rotate, ctrl click to snap a template, alt
  to preview vision.

Tongs Browser fixes all three by synthesising a persistent virtual mouse pointer driven by your
finger, adding a sticky modifier key bar, and scaling the interface for small screens.

Status: **early development.** The code is complete and tested, but it has not yet been run against a
real Foundry instance on a real device. See [docs/MANUAL-TESTING.md](docs/MANUAL-TESTING.md).

## Installation

Paste this into Foundry's **Install Module** box:

```
https://raw.githubusercontent.com/LewisIsWorking/Tongs-Browser/main/module.json
```

Compatible with Foundry **v14** (verified against 14.365).

## How it works

The pointer is a trackpad, not a touchscreen. Your finger moves the pointer; the pointer decides what
gets clicked. That indirection is the entire point: it is what lets hover states fire, and it means
your finger is never on top of the thing you are trying to hit.

## Gesture map

| Gesture                    | Action                                                                  |
| -------------------------- | ----------------------------------------------------------------------- |
| One finger drag            | Move the pointer                                                        |
| Tap                        | Left click **at the pointer**, not under your finger                    |
| Long press (500ms default) | Right click, with a short vibration                                     |
| Double tap                 | Double click                                                            |
| Tap, then press and hold   | Begin a left button drag. The cursor changes to show the button is held |
| Two finger drag            | Pan the map                                                             |
| Pinch                      | Zoom                                                                    |
| Modifier bar               | Latch Ctrl, Shift or Alt, or tap Space, Delete, Escape, Enter or Tab    |

Modifier keys are three state. Tap to latch for the next action, tap again to lock until released,
tap a third time to clear. The three states look different from each other, and not only by colour.

Text inputs, the chat log, the sidebar and any scrollable region are left alone entirely, so typing
and native scrolling work exactly as they did before.

## Settings

All settings are per client, so every player configures their own device.

| Setting               | Default  | Range              | What it does                                                                                                        |
| --------------------- | -------- | ------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Enabled               | on       |                    | Master switch. Also on the scene controls as a one tap toggle                                                       |
| Pointer mode          | Trackpad | Trackpad or Offset | Trackpad moves relatively and suits a phone. Offset puts the pointer above your finger and suits a tablet           |
| Sensitivity           | 1.5      | 0.5 to 3.0         | How far the pointer travels per finger movement, trackpad mode only                                                 |
| Cursor size           | 28px     | 16 to 48           | Pointer diameter                                                                                                    |
| Offset distance       | 60px     | 0 to 120           | How far above your finger the pointer sits, offset mode only                                                        |
| Long press duration   | 500ms    | 300 to 1000        | How long to hold for a right click                                                                                  |
| Haptic feedback       | on       |                    | Vibrate on long press                                                                                               |
| Suppress native touch | on       |                    | Stop the browser sending its own touch events to Foundry. Turn off if you want another touch module to handle input |
| Show modifier bar     | on       |                    | Show the floating key bar                                                                                           |
| Interface scale       | 75%      | 50 to 100%         | Shrink the Foundry interface. Does not affect the map                                                               |
| Debug overlay         | off      |                    | Outline the element under the pointer and log every event                                                           |

## Relationship to TouchVTT

**Tongs Browser is complementary to TouchVTT, not a replacement for it.** They solve overlapping
problems in different ways, and which you want depends on how you play.

TouchVTT translates gestures directly into Foundry actions. It is excellent at what it does and does
not try to create a pointer, so hover states remain unavailable and modifier held actions remain out
of reach.

Tongs Browser creates a persistent pointer, which is what makes hover and modifiers work, at the cost
of a slightly more indirect feel: you move a pointer rather than touching the thing you want.

If you want both installed, turn **Suppress native touch** off in Tongs Browser. Both modules bind
the same touch events, and with suppression on, Tongs Browser stops the browser's own touch derived
events before TouchVTT sees them. With it off they can coexist, though you may find the two fighting
over the same gestures. Please report what you find.

## Known conflicts

Nothing confirmed yet. This section will be filled in from real testing rather than guesswork, and
anything found will be documented here rather than silently worked around.

Modules that bind `touchstart` on the document, or that render into the canvas container, are the
most likely candidates.

## Architecture

Decision records live in [docs/adr](docs/adr):

- [0001 Ship a module before a native shell](docs/adr/0001-module-before-native-shell.md)
- [0002 Native Android shell, phase 2](docs/adr/0002-native-android-shell.md)
- [0003 Synthesise both PointerEvent and MouseEvent](docs/adr/0003-pointerevent-vs-mouseevent.md)

0003 is the one to read first if you are picking this up after a Foundry version bump. It records
what was empirically verified about PIXI, hit testing and CSS transforms, including two places where
the original design assumptions turned out to be wrong.

## Development

Requires Node 22 or newer.

```
npm ci
npm run verify     # lint, typecheck, test, build
```

Individual steps: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`.
Use `npm run dev` for a watching build while working against a live Foundry instance.

The test suite splits into two projects on purpose. The `unit` project runs in plain node with no DOM
at all, which structurally enforces that the event sequence builders and the gesture state machine
stay pure: if one reaches for `document`, its test fails immediately rather than passing quietly. The
`dom` project covers dispatch ordering, hover transitions and exclusion zones under jsdom.

### Releases

Versioning runs on [Changesets](https://github.com/changesets/changesets). Every pull request that
changes behaviour should include one:

```
npm run changeset
```

Merging to `main` opens a "Version Packages" pull request that bumps the version and writes
`CHANGELOG.md`. Merging that creates a `v*` tag, which triggers CI to build `module.zip`, stamp the
matching version and download URL into `module.json`, and publish a GitHub release.

## License

MIT. See [LICENSE](LICENSE).
