---
'tongs-browser': patch
---

Fix a scene control toggle that could not be switched off before `ready`.

`isActive` fell back to the stored setting; `onToggle` did not. So before `ready` builds the instance,
the button reported ON from the store and a tap computed `!(undefined ?? false)` and wrote `true`
again. The two callbacks disagreed about where the truth lives. Behaviour is identical once the
instance exists, which is how it survived.

Found by invoking the callback rather than asserting the hook was registered, which is all the
existing suite did.

Also corrects date stamps written earlier in this session. Work done on 2026-08-30 was stamped
2026-08-22 across fifteen files, including the record of the first Android run. A dated measurement
is only worth having if the date is right.
