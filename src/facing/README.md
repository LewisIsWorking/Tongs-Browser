# src/facing

Default token facing: every new token mirrored both ways and free to rotate. Added 2026-11-14. Since
2026-11-18 also every token's vision on at a 160 degree cone.

| File                  | What it is                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------- |
| `tokenFacing.ts`      | The rules: a prototype's facing, a new token's rotation, the scale a locked slider left out |
| `tokenVision.ts`      | The vision rule: on, at 160 degrees unless someone chose another angle                      |
| `startTokenFacing.ts` | The world setting, the creation hooks, the Mirror tick fix                                  |
| `applyTokenFacing.ts` | The GM's button and API call: facing and vision for every actor, vision for placed tokens   |

## What it does

The world setting **"Default token facing: mirror both ways, unlocked rotation"** is on by default, and
only a GM can change it.

- **A new actor** gets a prototype token with `texture.scaleX` and `texture.scaleY` negative (the size is
  kept, only the sign changes) and `lockRotation: false`. An actor whose creator already asked for a
  mirror on either axis is left as asked.
- **A new token** whose art is mirrored both ways and whose rotation is 0 is placed at rotation 180, so
  the art shows upright and can still be turned to face a direction.
- **Existing actors** are never changed by themselves. In Configure Settings, Tongs Browser, the GM's
  **"Apply to every actor"** button asks first, then changes them and says how many. A GM's macro can do
  the same with `game.modules.get('tongs-browser').api.applyTokenFacingToAllActors()`, which resolves to
  the count. Tokens already on a scene are not touched.

## Vision (2026-11-18)

Lewis: "Can we also set vision to be enabled on all tokens and set their vision is 160°?" The same setting
turns `sight.enabled` on and sets `sight.angle` to 160 on new actors' prototypes and on new tokens. Only
Foundry's own 360 becomes 160; any other angle was chosen and stays. Range is left alone, because PF2e's
rules-based vision sets it from the sheet's senses. The button gives existing actors the vision too, and
gives tokens already on a scene the vision only (their mirror and rotation are never touched).

⚠️ PF2e switches vision off for NPCs, hazards and loot when they are made. This turns it on for every token,
as asked: a GM sees everything regardless, and a player sees only through tokens they can observe. It also
matters outside Foundry: the Nudge bot's /map draws what the party's tokens can see, cone included.

## Why it is needed

PF2e marks every new actor's prototype token `lockRotation: true` (its schema's initial value), and core
never mirrors anything by default.

## Who writes

`preCreateActor` and `preCreateToken` run only in the browser creating the document, and the change is
made with `updateSource` before it is saved. One browser, one write, and no GM needs to be online.

## The Mirror ticks in the Prototype Token form

⛔ PF2e 8.7 on Foundry 14.370 drops the Mirror Image ticks whenever PF2e's auto-scale has locked the Scale
slider. The disabled slider is not submitted, core only writes the mirror into `texture.scaleX`/`scaleY`
when `scale` is a number (and then deletes the ticks), and PF2e puts `scale` back only after that.

Tongs listens for the form's `formdata` event, which Foundry's `FormDataExtended` fires before either of
them reads the data, and fills in the saved size when `scale` is missing. No PF2e or core class is
patched. When `scale` arrives as a number, as it will once PF2e or core fixes this, it does nothing.
