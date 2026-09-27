---
'tongs-browser': minor
---

A GM's Tongs can now add a new player to the running world without a restart: COO's heartbeat reply lists the players to create, each with a one-time password for this world only, and Tongs creates them with COO's exact id and confirms which it made. The heartbeat also reports how long the GM has been idle.

New world setting "Sign out an idle GM (minutes)", default 120: after that long with no mouse or keyboard activity a GM is asked "Still there?" and, five minutes later, signed out, so an unattended browser no longer holds the world for other campaigns. 0 turns it off.
