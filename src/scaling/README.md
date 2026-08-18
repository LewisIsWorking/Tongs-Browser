# src/scaling

Making Foundry's interface usable at arm's length on a tablet.

| File                   | What it is                                  |
| ---------------------- | ------------------------------------------- |
| `UiScaler.ts`          | Applying a scale factor to Foundry's chrome |
| `ScaleRegions.ts`      | Which parts of the interface scale, as data |
| `WindowClamp.ts`       | Keeping a scaled window inside the viewport |
| `WindowClampBinder.ts` | Watching for windows that need clamping     |

## Scaling is not one number applied to everything

Scaling the whole document would scale the canvas too, which is the one thing that must not move: the
board has its own zoom, and doubling both leaves the map twice as far from the interface as it
started. `ScaleRegions.ts` names the regions that scale, so the set is reviewable rather than implied
by whatever selector happened to be written.

## Scaling makes things fall off the screen

A window positioned by Foundry at a sensible desktop coordinate can end up half outside the viewport
once its own size grows. `WindowClamp.ts` pulls it back; `WindowClampBinder.ts` applies that to
windows as they appear, because Foundry creates them long after the module has initialised.

The clamp is arithmetic on a box and is tested as such, separately from the DOM plumbing that finds
the boxes. That split is what makes the awkward cases (a window taller than the viewport, a window
positioned negatively) testable at all.
