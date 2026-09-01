---
'tongs-browser': patch
---

Record how a party stores its members, read from the sf2e system's own bundle.

Members live at `system.details.members` as `{ uuid }` entries, and `party.members` resolves them with
`fromUuidSync`, which silently drops anything this client never received. A picker built on that
inherits the "never show what the user cannot see" rule rather than having to implement it.

⚠️ `addMembers` sets `folder: null` on each new character or npc member. Joining a party takes an
actor out of its folder, so "create the sheet, choose a party, and file it in a folder" is not
something the system supports.

Also removes the browser permissions probe, which never ran: reading Foundry's shipped source answered
the same questions better, and an unrun script in `scripts/` reads as evidence somebody gathered.
