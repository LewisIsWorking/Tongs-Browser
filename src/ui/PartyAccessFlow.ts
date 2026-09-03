import { describePartyAccess } from '../foundry/PartyFlag.js';
import type { FlagOutcome } from '../foundry/PartyFlag.js';
import type { PartyCandidate, Viewer } from '../foundry/PartyRoster.js';
import { buildChoiceMenu, buildNotice } from './ChoiceMenu.js';
import { ACCESS_NOTICES } from './CreateSheetMessages.js';

/**
 * Letting a GM open or close a party to players. Added 2026-09-03.
 *
 * ⚠️ A separate flow from creating, deliberately, even though both list parties. They answer
 * different questions: "where shall I put this character" is asked often and by anybody allowed,
 * while "who may add characters here" is a GM setting changed rarely. Folding the second into the
 * first would mean every create had a mode to be in, and a mis-tap would silently change a permission
 * instead of making a sheet.
 *
 * ⚠️ EVERY party the GM can see, not just the creatable ones. `creatableParties` filters to what the
 * viewer may create in, which is the wrong list here: a closed party is precisely the one a GM opens,
 * so filtering it out would hide every party they might want to change.
 */
export interface PartyAccessPorts {
  readonly document: Document;
  readonly host: () => HTMLElement;
  readonly readParties: () => readonly PartyCandidate[];
  readonly readViewer: () => Viewer;
  readonly setAccess: (partyUuid: string, enabled: boolean) => Promise<FlagOutcome>;
  readonly report: (message: string) => void;
}

export function beginPartyAccess(ports: PartyAccessPorts): void {
  /*
   * ⚠️ Checked here as well as by the button being hidden. The button is one way in; a keyboard
   * shortcut or a future caller is another, and a permission enforced only by a control's visibility
   * is not enforced at all.
   */
  if (!ports.readViewer().isGm) {
    ports.host().append(buildNotice(ports.document, ACCESS_NOTICES.notGm));
    return;
  }

  const parties = ports.readParties();
  if (parties.length === 0) {
    ports.host().append(buildNotice(ports.document, ACCESS_NOTICES.noParties));
    return;
  }

  ports.host().append(
    buildChoiceMenu(ports.document, {
      title: 'Who may add characters?',
      /*
       * ⚠️ The label carries the CURRENT state, so the list can be read at a glance. A row saying
       * only the party name would make every row identical and give a GM no way to see which parties
       * are already open without tapping them and watching what changes.
       */
      choices: parties.map((party) => ({ id: party.uuid, label: describePartyAccess(party) })),
      onChosen: (uuid) => {
        void toggle(ports, uuid);
      },
    })
  );
}

/**
 * ⚠️ Re-reads the party rather than using the one captured when the list was drawn.
 *
 * The first version searched the captured array, which made the "gone" branch UNREACHABLE: the uuid
 * came from a row built out of that same array, so the lookup could never miss, and no honest test
 * could reach the guard. Reading again makes it both reachable and worth having, because the thing it
 * guards is real: a party can be deleted, or another GM can change it, between the list being drawn
 * and a row being tapped.
 *
 * Acting on the state read NOW rather than the state shown is the right way round for the same
 * reason. If another GM opened this party a moment ago, the honest response to a tap is to close it,
 * not to open something already open because the stale label said so.
 */
async function toggle(ports: PartyAccessPorts, uuid: string): Promise<void> {
  const party = ports.readParties().find((candidate) => candidate.uuid === uuid);
  if (party === undefined) {
    ports.report(ACCESS_NOTICES.vanished.message);
    return;
  }

  const wanted = !party.playerCreationEnabled;
  const outcome = await ports.setAccess(uuid, wanted);

  if (outcome.kind === 'failed') {
    ports.report(`${ACCESS_NOTICES.failed.message} ${outcome.reason}`);
    return;
  }

  /*
   * ⚠️ Confirmed out loud. A permission change has no visible effect on this screen: nothing moves,
   * no sheet opens, and the picker has already closed. Silence would be indistinguishable from a tap
   * that missed, and the GM would have no way to tell without reopening the list.
   */
  ports.report(
    outcome.enabled
      ? `${party.name}: players may now add characters.`
      : `${party.name}: closed to players.`
  );
}
