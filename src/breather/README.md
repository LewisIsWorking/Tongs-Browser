# src/breather

**Take a Breather (No-Limit Stamina)**: PF2e's Stamina variant "Take a Breather", for out-of-combat healing, without
the Resolve Point. Lewis, 2026-11-02: "Could we add a take an unlimited stamina version of the take a breather
macro to TONGS that does this but doesn't use a resolve point for out of combat healing?"

It is the Gamemastery Guide's **No-Limit Stamina** option, which Lewis pasted: "skip the Resolve Point component
of this subsystem and simply make Taking a Breather and Rally free". The chat card names the rule.

| File               | What it is                                                                         |
| ------------------ | ---------------------------------------------------------------------------------- |
| `takeABreather.ts` | The action, ported from PF2e's `takeABreather`: confirm, refill Stamina, chat card |
| `breatherMacro.ts` | The world macro a GM's browser makes once, and the `api` call the macro runs       |
| `breatherPost.ts`  | The GM's browser telling the character's campaign's combat topic about each one    |

## Where players find it

The **Macro Directory**, as a Script macro named "Take a Breather (No-Limit Stamina)" that every player may run
(drag it to the hotbar). The active full GM's browser makes it once per world, only when the world uses the
Stamina variant. Any macro or console can also call
`game.modules.get('tongs-browser').api.takeABreatherNoLimit()`.

## The combat topic

Lewis, 2026-11-02: "Could the macro always post to that campaign's combat topic regardless of if they are in
combat?" Each card carries a `breather` flag (name, Stamina before, max, token art). The active full GM's browser
hears `createChatMessage` and posts it to ComeOnOverUno's `POST api/pathwars/campaigns/{code}/breather`, which
renders the line for the campaign's combat topic, fight or no fight.

- ⚠️ **The campaign is the character's**, from the parties listing it (`campaignOfCharacter`, as the HP log
  reads it), never an encounter's. In a world serving C00 and C01 it is the one whose party lists the character.
- ⚠️ **Only a GM's browser can post**: the player who ran the macro has no ComeOnOverUno sign-in. With no GM on,
  the card is in Foundry's chat and nothing reaches the topic.
- ⚠️ **Silent when it cannot post** (no campaign, not signed in, a server without `breather`); each is logged.

## What it does, against PF2e 8.6.1's own

- **The same**: the selected tokens, else the assigned character; characters only; a confirm dialog; Stamina
  Points refilled to their max; one chat card per character, spoken as its token, naming the 10 minute rest.
- **No Resolve Point** is needed or spent, and the card says so in so many words.
- **A world without the Stamina variant is told so.** PF2e's returns silently, which looks broken.
- **A character in a started encounter is skipped**, with a card saying why: this is the out-of-combat version.
- **The assigned character counts with no token placed.** PF2e's needs a token on the scene.

## Learnings

- ⚠️ **Only Take a Breather.** PF2e 8.6.1 has no Rally macro or action to port (no "rally" in `pf2e.mjs`), and
  Steel Your Resolve is left exactly as PF2e has it. Lewis, 2026-11-02: it still spends a Resolve Point as
  normal, with no other limit; only Take a Breather is free.

- ⚠️ **SF2e reads the same setting.** SF2e 1.6.1 checks `game.pf2e.settings.variants.stamina` too (ten times in
  `sf2e.mjs`), so one test covers both systems.
- ⚠️ **PF2e's own card is posted before its update lands** (`actor.update` is not awaited). Here the update is
  awaited first, so a refused update never leaves a card claiming a refill.
- ⭐ **Made once, then left alone.** The hidden world setting `breatherMacroMade` remembers it, so a GM who
  deletes the macro does not get it back at every launch.
