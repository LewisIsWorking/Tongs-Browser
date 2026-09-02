---
'tongs-browser': patch
---

Add the flow that joins the create-sheet pieces: tap, choose a party, choose an owner, get a sheet.

It only sequences work decided elsewhere. `PartyRoster` says who may create where, `PartyAccess` says
what exists, `SheetCreation` writes, `ChoiceMenu` draws. None of the rules live in the flow, where a
UI change could disturb them.

No text input: the sheet is created with a default name and then opened, so renaming happens in
Foundry's own sheet. A text field on a phone means a keyboard over most of the screen, which is the
class of problem this module exists to avoid.

Every outcome is reported, and a sheet created outside its party is opened as well as explained,
because it exists and leading with the failure would invite a duplicate.
