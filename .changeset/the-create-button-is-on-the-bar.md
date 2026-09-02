---
'tongs-browser': patch
---

Put the create-sheet button on the tray and wire it to Foundry. Slice 3 of the feature is complete.

The button is GM only until the relay lands. A player cannot create an actor without Foundry's
`ACTOR_CREATE` and cannot be handed ownership by anyone but a GM, so a button offered to them now
could only ever fail. Absent beats present and broken: a control that invites a tap and then fails
reads as a broken module rather than an unfinished feature.

`CreateSheetDeps` holds the real `Actor.create` and `fromUuid` calls, and throws rather than resolving
quietly when either is missing, because a thrown reason becomes a sentence the user reads. It also
names the likeliest failure in the wild: a party on a system with no `addMembers`.

The ports are rebuilt on every tap, since the party list, the user list and who is asking can all
change between one press and the next.
