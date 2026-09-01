# Creating character sheets from the control pad

Design notes, 2026-09-01. Requested by Lewis; the three shaping decisions below are his.

## What is being built

1. A control pad button that creates a character sheet, puts it in a chosen **party**, and assigns a
   chosen **user** as its owner.
2. The same button available to **players**, but only able to create inside parties whose GM has
   switched creation on.
3. Nothing in this feature, or anywhere else the module already shows a list, may name a sheet, party
   or folder the current user has no permission to see.

## The decisions taken

| Question                         | Decision                                                      |
| -------------------------------- | ------------------------------------------------------------- |
| Scope of the visibility rule     | The new UI **and** an audit of the module's existing surfaces |
| Where the per-party switch lives | A module **flag on the party actor**                          |
| What a player's tap does         | Creates **immediately**, no GM approval step                  |

## ⚠️ The constraint the whole design turns on

**A player cannot assign ownership to anyone but themselves.** Measured below rather than assumed:
they may own what they create, and any entry naming a different user is refused. Since requirement 1
is "assign to a user", and a GM handing a sheet to a player is the normal case, that is the whole
operation gone.

This is not a new discovery in this repo, and the existing note in `foundry/PauseControl.ts` is worth
repeating because it is the trap: the check is on the ACTION, not on permissions, so granting a player
ownership of something does not buy the ability to perform a GM-only operation. `PauseRelay` exists
for exactly this reason, and its docblock records that the obvious workarounds do not work and one of
them "is widely repeated as if it does".

So creation runs on a GM's client, asked for over the socket. That has a consequence worth stating
plainly rather than discovering on a device:

> ⚠️ **A GM must be online for a player to create a sheet.** There is no way around it, and the UI has
> to say so rather than failing silently.

It also has a benefit that falls out for free, and it is the reason this is the right shape rather
than merely the possible one: **players never need Foundry's `ACTOR_CREATE` permission**. Granting
that would let them create actors anywhere, by any route, for the rest of the world's life. Routing
through the relay means the party flag is the _only_ thing that authorises creation, which is exactly
what requirement 2 asks for.

### Reuse, do not copy

`PauseRelay` is single-purpose. The parts worth generalising rather than duplicating:

- **`isDesignatedGm`**, not "am I a GM". Its docblock records why: with three GMs connected, every one
  of them answers the request and the result lands wherever the race leaves it.
  `game.users.activeGM` picks the same single user on every client.
- The narrow `SocketLike` interface, and a payload validator that rejects anything unexpected, so an
  older client cannot be confused by a newer field.

## ✅ Measured 2026-09-01, from Foundry 14.366's own source

Read out of the shipped server code rather than probed, which is stronger: this is the function that
actually enforces the rule, not a client-side prediction of it.
`resources/app/dist/database/sanitization.mjs`, `sanitizeDocumentOwnershipField`.

**A GM may write any ownership.** The function returns the value untouched when the acting user is a
GM, and its error message names "a GM or Assistant GM user", so the Assistant role qualifies too.

**A non-GM may set ownership for THEMSELVES**, on create and on update. Their own id is skipped by the
violation check.

**A non-GM may not grant ownership to ANYONE ELSE**, and the two failure modes are not the same:

| what a player does                                          | what happens                                                  |
| ----------------------------------------------------------- | ------------------------------------------------------------- |
| updates an existing document to give another user ownership | throws, `"may only be modified by a GM or Assistant GM user"` |
| **creates** a document with ownership for another user      | ⚠️ **the entry is silently deleted**                          |

> ⚠️ **The creation path fails silently.** `i.creation ? delete t[a] : n=!0` - on creation the offending
> entry is removed and the document is created without it. No error, no warning. The sheet exists, the
> player owns it, and the person it was meant for simply does not.
>
> This is the whole feature's central operation failing in the one way nothing would report. It is
> also the strongest argument for the relay: a player-side create that assigns to somebody else would
> look like it worked, every time, and the bug would surface days later as "why can't I open my
> character".

**`ACTOR_CREATE`** (`common/constants.mjs`): `requiredRoles: [ASSISTANT, GAMEMASTER]`,
`defaultRole: ASSISTANT`. `requiredRoles` means the permission cannot be REVOKED from those roles, not
that others cannot be granted it: `User#hasPermission` falls through to `game.permissions[permission]`,
so a GM _can_ grant it to players. We still do not want that, for the reason above: it would authorise
creation everywhere, by any route, permanently.

### What this settles

The relay is not a preference. Assigning a sheet to another user is a GM-only operation, and the
player-side version of it does not even fail loudly.

## ✅ Measured 2026-09-01, from the sf2e system's own bundle

Read from `Data/systems/sf2e/sf2e.mjs` (Starfinder 2e 1.4.0), which is PF2e-derived.
⚠️ **A proxy, not the thing itself.** Re-measure on pf2e before shipping.

**Members are stored at `system.details.members`, as an array of `{ uuid }`.** UUIDs, not ids, and not
declared in `template.json`: the party model is a DataModel in code.

**Reading members is permission-safe by accident, and usefully so:**

```js
this.members = this.system.details.members
  .map((e) => fromUuidSync(e.uuid))
  .filter((e) => e instanceof Actor && e.isOfType('creature'))
  .sort(byName);
```

`fromUuidSync` returns nothing for a document this client never received, so a member the user cannot
see silently drops out of `party.members`. A picker built on `party.members` inherits requirement 3
rather than having to implement it. That is worth knowing, and worth asserting rather than relying on.

### ⚠️ `addMembers` clears the actor's folder

```js
for (let e of newMembers) {
  let t = e.isOfType('character', 'npc') ? { 'system.details.alliance': ... ?? 'party' } : {};
  await e.update({ folder: null, ...t });
}
```

**Joining a party sets `folder: null` on the actor.** A party member does not live in a folder; the
party IS its home. So "create the sheet, choose a party, and file it in a folder" is not a thing this
system supports: the folder would be silently cleared the moment the party took it.

That is worth raising with Lewis rather than deciding quietly, because his requirement mentions
folders. The likely reading is that folders matter for VISIBILITY, not placement, and nothing here
conflicts with that.

It also sets `system.details.alliance` to `party` for a `character` or `npc` that has none.

### Who may do it

`addMembers` calls `update` on the party actor and on each new member. A player therefore needs
OWNER on both to add themselves, which they will not have on the party. Party assignment is GM
territory for the same reason ownership assignment is, and goes through the same relay.

## Verification reality on this machine

⚠️ **The PF2e system is not installed here.** `Data/systems` holds `coo`, `sf2e` and `worldbuilding`.

`sf2e` (Starfinder 2e 1.4.0) is built on the PF2e codebase and **does declare a `party` actor type**,
so it is a usable proxy for the party half of this work. It is a proxy and not the thing itself:
anything measured against `sf2e` must be re-measured on `pf2e` before this is called done.

### On the probe that was written and then deleted

A browser probe was written to ask a running Foundry these questions, and it **never ran**: Playwright's
headless shell needed reinstalling after an update. Reading the shipped source answered the same
questions better, because it is the code that enforces the rule rather than a client's report of it,
and it needed no world, no browser and no login.

It was deleted rather than left in place. An unrun script sitting in `scripts/` reads as evidence
somebody gathered, and the next person to see it would reasonably assume its questions had been asked.
Same reasoning as removing `CanvasController.isAvailable()`: code nothing runs is not neutral.

## Proposed slices

Each is separately shippable and separately testable, and none is useful without the one before it.

1. **Measure.** ✅ Done, both halves, read from shipped source rather than probed. Permissions from
   Foundry's own enforcement code; party membership from the sf2e bundle. Re-measure the party half on
   pf2e before shipping.
2. **The visibility audit** (requirement 3). ✅ Done, and it produced a guard rather than a report:
   `npm run check:documents` forces every listing of Foundry documents through one boundary, so the
   permission filter is written once. It immediately found what a hand grep had missed, because
   `game.actors` with an unescaped dot cannot match `game?.actors`. ⚠️ When a picker lands, add its
   file to `BOUNDARY` in `scripts/check-document-access.ts` and filter in the same breath as
   enumerating.
3. **GM-only creation.** The button, a party picker, a user picker, and creation performed locally
   because a GM is already allowed to do all of it. No socket traffic yet.
4. **The party flag.** A GM-only switch per party, and the plumbing to read it.
5. **Player creation over the relay.** The generalised request/response, `isDesignatedGm`, and the
   "no GM online" state in the UI.

Slice 3 is the first one with visible value, and slices 1 and 2 are what stop it being built on
guesses.
