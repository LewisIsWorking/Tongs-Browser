import { assignableUsers, decideCreation } from '../foundry/PartyRoster.js';
import type { AssignableUser, PartyCandidate, Viewer } from '../foundry/PartyRoster.js';
import { buildChoiceMenu, buildNotice } from './ChoiceMenu.js';
import { DEFAULT_SHEET_NAME, NOTICES } from './CreateSheetMessages.js';
import type { SheetCreationOutcome } from '../foundry/SheetCreationTypes.js';

/**
 * Tap the button, end up with a sheet. Added 2026-09-02.
 *
 * ⚠️ Everything this coordinates is already decided elsewhere, on purpose. `PartyRoster` says who may
 * create where, `PartyAccess` says what exists, `SheetCreation` does the writing, `ChoiceMenu` draws.
 * This file only sequences them, which is why it can be read in one sitting and why none of the rules
 * live here where a UI change could disturb them.
 *
 * ⚠️ NO TEXT INPUT. The sheet is created with a default name and then OPENED, so renaming happens in
 * Foundry's own sheet where there is room for it. A text field on a phone means the keyboard covering
 * most of the screen, which is the class of problem this whole module exists to avoid.
 */
export interface CreateSheetPorts {
  readonly document: Document;
  /** Where the pickers are attached. Injected so a test does not have to guess at the bar's markup. */
  readonly host: () => HTMLElement;
  readonly readParties: () => readonly PartyCandidate[];
  readonly readUsers: () => readonly AssignableUser[];
  readonly readViewer: () => Viewer & { readonly id: string };
  readonly create: (request: {
    name: string;
    ownerId: string;
    partyUuid: string;
  }) => Promise<SheetCreationOutcome>;
  /** ⚠️ Reported, never thrown away: a phone user has no console to read. */
  readonly report: (message: string) => void;
}

function show(ports: CreateSheetPorts, node: HTMLElement): void {
  ports.host().append(node);
}

function notice(ports: CreateSheetPorts, of: { title: string; message: string }): void {
  show(ports, buildNotice(ports.document, of));
}

/**
 * Ask which party, unless the answer is already known.
 *
 * ⚠️ `noParties` and `notAllowed` say DIFFERENT things. "There are no parties" invites making one;
 * "you may not create here" tells a player to ask their GM. Reporting the first when the truth is the
 * second sends somebody looking for a party that already exists and that they cannot use.
 */
export function beginCreateSheet(ports: CreateSheetPorts): void {
  const viewer = ports.readViewer();
  const verdict = decideCreation(ports.readParties(), viewer);

  switch (verdict.kind) {
    case 'noParties':
      notice(ports, NOTICES.noParties);
      return;
    case 'notAllowed':
      notice(ports, NOTICES.notAllowed);
      return;
    case 'onlyParty':
      chooseOwner(ports, viewer, verdict.party.uuid);
      return;
    case 'choose':
      show(
        ports,
        buildChoiceMenu(ports.document, {
          title: 'Which party?',
          choices: verdict.parties.map((party) => ({ id: party.uuid, label: party.name })),
          onChosen: (partyUuid) => {
            chooseOwner(ports, viewer, partyUuid);
          },
        })
      );
      return;
  }
}

/**
 * Ask who owns it, unless there is only one answer.
 *
 * ⚠️ A player's list is themselves and nobody else, decided by `assignableUsers` rather than here,
 * because Foundry silently discards an ownership entry naming anyone else. One name means no picker:
 * a choice of one is a tap to reach a tap.
 */
function chooseOwner(
  ports: CreateSheetPorts,
  viewer: Viewer & { id: string },
  party: string
): void {
  const candidates = assignableUsers(ports.readUsers(), viewer);

  const only = candidates.length === 1 ? candidates[0] : undefined;
  if (only !== undefined) {
    void createFor(ports, party, only.id);
    return;
  }

  if (candidates.length === 0) {
    notice(ports, NOTICES.noUsers);
    return;
  }

  show(
    ports,
    buildChoiceMenu(ports.document, {
      title: 'Whose character?',
      choices: candidates.map((user) => ({ id: user.id, label: user.name })),
      onChosen: (ownerId) => {
        void createFor(ports, party, ownerId);
      },
    })
  );
}

/** ⚠️ Every outcome is reported. A create that quietly did nothing is the worst of the three. */
async function createFor(
  ports: CreateSheetPorts,
  partyUuid: string,
  ownerId: string
): Promise<void> {
  const outcome = await ports.create({ name: DEFAULT_SHEET_NAME, ownerId, partyUuid });

  switch (outcome.kind) {
    case 'created':
      outcome.sheet.sheet?.render?.(true);
      return;
    case 'createdOutsideParty':
      /*
       * ⚠️ The sheet EXISTS. Opening it as well as saying so is deliberate: the user can see what was
       * made, which is what stops this reading as a failure and inviting a second attempt.
       */
      outcome.sheet.sheet?.render?.(true);
      ports.report(`${NOTICES.outsideParty.message} ${outcome.reason}`);
      return;
    case 'notCreated':
      ports.report(`${NOTICES.notCreated.message} ${outcome.reason}`);
      return;
  }
}
