/**
 * A list of things to tap, and a way to say why there is nothing to tap. Added 2026-09-02.
 *
 * ⚠️ Built rather than reusing `buildSidebarMenu` because that one names Foundry's tabs and this one
 * names documents. Sharing it would mean one function whose rows sometimes carry a tab name and
 * sometimes a uuid, and the picker that shows a party is exactly where a wrong id must not be
 * possible.
 *
 * ⚠️ THE MENU CLOSES ITSELF, before the callback runs. `SidebarMenu` leaves that to the caller and
 * #304 showed why that is a mistake: `FoundryActions` had to remember to close the picker AND act,
 * and the close is the half that is invisible when lost. The picker simply sits on top of whatever it
 * just opened, the tap reads as having done nothing, and nothing throws. Closing here means no caller
 * can forget.
 */

/** One tappable row. `id` is what the caller acts on; `label` is all the user sees. */
export interface Choice {
  readonly id: string;
  readonly label: string;
}

export interface ChoiceMenuOptions {
  /** Says what is being chosen, so a picker of parties is not mistaken for a picker of users. */
  readonly title: string;
  readonly choices: readonly Choice[];
  readonly onChosen: (id: string) => void;
}

/**
 * ⚠️ Marked so the gesture layer keeps away, which is what lets these be tapped at all. Without it a
 * tap here is routed through the virtual pointer and lands wherever the pointer happens to be, rather
 * than on the row under the finger.
 */
function shell(doc: Document, title: string, className: string): HTMLDivElement {
  const menu = doc.createElement('div');
  menu.className = className;
  menu.setAttribute('data-tongs-browser', 'ignore');

  const heading = doc.createElement('p');
  heading.className = 'tb-choice-menu__title';
  heading.textContent = title;
  menu.append(heading);

  return menu;
}

export function buildChoiceMenu(doc: Document, options: ChoiceMenuOptions): HTMLDivElement {
  const menu = shell(doc, options.title, 'tb-choice-menu');

  for (const choice of options.choices) {
    const item = doc.createElement('button');
    item.type = 'button';
    item.className = 'tb-choice-menu__item';
    item.dataset['choice'] = choice.id;
    item.textContent = choice.label;
    item.addEventListener('click', () => {
      /*
       * ⚠️ Removed BEFORE the callback, not after. The callback may open a sheet or take a moment
       * over a create, and a picker still on screen during that reads as the tap having missed,
       * which invites a second tap and a second sheet.
       */
      menu.remove();
      options.onChosen(choice.id);
    });
    menu.append(item);
  }

  return menu;
}

export interface NoticeOptions {
  readonly title: string;
  /** ⚠️ Say what to DO, not merely what went wrong. A phone user cannot open a console to find out. */
  readonly message: string;
}

/** A message with a way out, for when there is nothing to choose between. */
export function buildNotice(doc: Document, options: NoticeOptions): HTMLDivElement {
  const menu = shell(doc, options.title, 'tb-choice-menu tb-choice-menu--notice');

  const body = doc.createElement('p');
  body.className = 'tb-choice-menu__message';
  body.textContent = options.message;
  menu.append(body);

  const dismiss = doc.createElement('button');
  dismiss.type = 'button';
  dismiss.className = 'tb-choice-menu__item';
  dismiss.dataset['choice'] = 'dismiss';
  dismiss.textContent = 'OK';
  dismiss.addEventListener('click', () => {
    menu.remove();
  });
  menu.append(dismiss);

  return menu;
}
