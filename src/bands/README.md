# src/bands

Phase 2 step 3: enemies' health told to the table. The band goes to the Path Wars campaign's combat
topic when it changes, and the exact HP goes to the GM by DM on every change, both through the
ComeOnOverUno server. Off until a party has a campaign. Since 2026-09-28 the same topic also hears when a
player character is hurt: the damage, from what, and the HP left, with the character's picture.

| File                    | What it is                                                                   |
| ----------------------- | ---------------------------------------------------------------------------- |
| `healthBands.ts`        | Segments from HP, the creature type from traits, and the approved band words |
| `bandSubject.ts`        | Whether players may hear about a token, and under what name                  |
| `bandTokens.ts`         | Foundry's tokens and actors read into bands, as measured                     |
| `attackerView.ts`       | Whether players may be told who dealt a hit, and with which picture          |
| `partyCampaign.ts`      | Which campaign a combat belongs to, from its player characters' parties      |
| `combatCampaign.ts`     | Reading those parties' campaign flags from the encounter a creature is in    |
| `partyCampaignsMenu.ts` | The GM-only menu that sets each party's campaign                             |
| `settingsMenu.ts`       | A GM-only settings button that opens something, as an ApplicationV2          |
| `bandCause.ts`          | What changed an enemy's HP, in words for the GM's DM, or "manual change"     |
| `causeWatch.ts`         | Waiting for PF2e's damage-taken card after a change, and reading it          |
| `BandReporter.ts`       | Deciding what to post and when: public only on a band change, one at a time  |
| `bandPorts.ts`          | What both reporters share: who acts, the campaign, the cause, warning the GM |
| `playerHit.ts`          | Whether an HP change is a hit on a player character, and its post            |
| `PlayerHitReporter.ts`  | Posting those hits, in order, against the HP remembered before each          |
| `startPlayerHits.ts`    | The player-hit setting, and building its reporter                            |
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

## Decided with Lewis, 2026-09-28: hits on player characters

- **"Damage and HP left", in the open**: "Arktos takes 12 from Captain Vex's cutlass. 31/43 HP", with the
  character's picture. Unlike a band, the exact numbers are public: a player character's HP is the table's.
  Its own endpoint, `player-hit`, so the band's rule (never HP in public) stays absolute.
- **A player character is `type: "character"`**, owned or not; since the self-hosted Foundry none are owned.
- **On by default** (`postPlayerHits`), because it posts and never changes anything. Who hit it is told only
  when players can see the attacker, exactly as for bands.
- ⚠️ Foundry's `updateActor` carries only the new HP, so the old one is remembered from the fight's start.
  A character first seen mid-change is remembered, not posted: a guessed amount would be a wrong one.

## Measured, not assumed

- **PF2e's Stamina variant spends Stamina Points first** (2026-10-07, the Kibwe world). A hit soaked by Stamina
  changes only `system.attributes.hp.sp.value`, so `updateActor` carries no `hp.value`. In one enemy phase 6 of 7
  hits went to SP and were never posted. A player hit is now the fall in HP and SP together, and the post carries
  the SP left when the character has a pool. Enemies (NPCs) have no Stamina pool, so bands still read HP alone.
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
