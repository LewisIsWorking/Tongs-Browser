# src/bands

Phase 2 step 3: enemies' health told to the table. The band goes to the Path Wars campaign's combat
topic when it changes, and the exact HP goes to the GM by DM on every change, both through the
ComeOnOverUno server. Off until the world names its campaign.

| File              | What it is                                                                   |
| ----------------- | ---------------------------------------------------------------------------- |
| `healthBands.ts`  | Segments from HP, the creature type from traits, and the approved band words |
| `bandSubject.ts`  | Whether players may hear about a token, and under what name                  |
| `bandTokens.ts`   | Foundry's tokens and actors read into bands, as measured                     |
| `BandReporter.ts` | Deciding what to post and when: public only on a band change, one at a time  |
| `CooClient.ts`    | Signing in to ComeOnOverUno and posting, keeping only a refresh token        |
| `cooSignIn.ts`    | The GM-only sign-in menu in the module settings                              |
| `startBands.ts`   | The settings, and connecting the reporter to Foundry's hooks                 |

## Decided with Lewis, 2026-09-14

- **The words**, ten segments plus down, per creature type: living, construct/robot, undead, ooze,
  incorporeal. They are the table in `healthBands.ts`; a change there is a change Lewis approved.
- **No secret in the module.** The GM signs in to ComeOnOverUno once; only the refresh token is kept,
  in a client setting in that browser. The COO endpoint requires the Admin role, and the bot token
  never leaves the COO server.
- **Only tokens players can see**, under the name they can see.

## Measured, not assumed

- `updateActor` fires for linked and unlinked tokens alike; an unlinked token's change arrives as its
  synthetic actor with `isToken: true` (pf2e 8.5.0).
- PF2e's name rule is `playersCanSeeName || !game.pf2e.settings.tokens.nameVisibility`, else "The
  creature". SF2e 1.5.0 has the same setting under `game.pf2e` and the same label.
- SF2e robots carry `construct` and `robot`. `tech` is also on androids and a metal elemental, so it is
  not read as a construct.
