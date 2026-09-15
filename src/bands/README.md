# src/bands

Phase 2 step 3: enemies' health told to the table. The band goes to the Path Wars campaign's combat
topic when it changes, and the exact HP goes to the GM by DM on every change, both through the
ComeOnOverUno server. Off until a party has a campaign.

| File                    | What it is                                                                   |
| ----------------------- | ---------------------------------------------------------------------------- |
| `healthBands.ts`        | Segments from HP, the creature type from traits, and the approved band words |
| `bandSubject.ts`        | Whether players may hear about a token, and under what name                  |
| `bandTokens.ts`         | Foundry's tokens and actors read into bands, as measured                     |
| `partyCampaign.ts`      | Which campaign a combat belongs to, from its player characters' parties      |
| `combatCampaign.ts`     | Reading those parties' campaign flags from the combat being viewed           |
| `partyCampaignsMenu.ts` | The GM-only menu that sets each party's campaign                             |
| `settingsMenu.ts`       | A GM-only settings button that opens something, as an ApplicationV2          |
| `bandCause.ts`          | What changed an enemy's HP, in words for the GM's DM, or "manual change"     |
| `causeWatch.ts`         | Waiting for PF2e's damage-taken card after a change, and reading it          |
| `BandReporter.ts`       | Deciding what to post and when: public only on a band change, one at a time  |
| `CooClient.ts`          | Signing in to ComeOnOverUno and posting, keeping only a refresh token        |
| `cooSignIn.ts`          | The GM-only sign-in menu in the module settings                              |
| `startBands.ts`         | The settings, and connecting the reporter to Foundry's hooks                 |

## Decided with Lewis, 2026-09-14

- **The words**, ten segments plus down, per creature type: living, construct/robot, undead, ooze,
  incorporeal. They are the table in `healthBands.ts`; a change there is a change Lewis approved.
- **No secret in the module.** The GM signs in to ComeOnOverUno once; only the refresh token is kept,
  in a client setting in that browser. The COO endpoint requires the Admin role, and the bot token
  never leaves the COO server.
- **Only tokens players can see**, under the name they can see.
- **The campaign is per party** (2026-09-15: C04, C05, C06, C07 and C09 share one world). A combat goes to
  the campaign of the player characters fighting in it; none, or two, and nothing is posted and the GM is
  told why.
- **Every HP change is recorded with its cause** in the GM's DM (the brief's rule): the item and who used
  it, and the IWR PF2e applied, or "manual change". Never on the public line, since it names resistances.

## Measured, not assumed

- `updateActor` fires for linked and unlinked tokens alike; an unlinked token's change arrives as its
  synthetic actor with `isToken: true` (pf2e 8.5.0).
- PF2e's name rule is `playersCanSeeName || !game.pf2e.settings.tokens.nameVisibility`, else "The
  creature". SF2e 1.5.0 has the same setting under `game.pf2e` and the same label.
- PF2e updates the actor BEFORE it creates the damage-taken card, whose `appliedDamage.uuid` is the actor's
  uuid and whose `origin` is the item's `getOriginData()` (`{ actor, uuid }`); the IWR is JSON in
  `.iwr[data-applications]`. So the cause is watched for from the moment of the update.
- A party adds itself to its members' `actor.parties` only when it is already in the world's actor list,
  so a party created mid-session is in none of them until something updates it (found live, pf2e 8.5.0).
  Membership is therefore read from each party's own `system.details.members`.
- SF2e robots carry `construct` and `robot`. `tech` is also on androids and a metal elemental, so it is
  not read as a construct.
