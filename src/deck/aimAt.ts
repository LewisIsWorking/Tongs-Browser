/**
 * Aiming PF2e's own controls at chosen tokens, on any scene. Added 2026-09-15, replacing `selection.ts`.
 *
 * ⛔ WHY NOT SELECT THEM. The deck used to control the target token, click PF2e's control, and give the
 * GM's selection back. Only a token on the scene being viewed can be controlled, so a hit on a creature
 * anywhere else waited until the GM opened that map, which in a play-by-post world with several scenes
 * running at once could be days. Found as a limit on Forge, 2026-09-15.
 *
 * ✅ WHAT IT DOES INSTEAD. Read in the pf2e 8.5.0 bundle (SF2e 1.5.0 identical): `applyDamageFromMessage`,
 * `#rollActorSaves` and `getSelectedActors` (behind inline checks) all take their tokens from
 * `game.user.getActiveTokens()`, and all three read it SYNCHRONOUSLY, before their first `await`. They
 * then use the token DOCUMENT (`token: n` into `applyDamage`, `n.actor` for a save), which exists
 * whatever scene is being viewed; `applyDamage` itself touches no canvas. So for the length of one
 * synchronous click, `getActiveTokens` answers exactly the chosen documents.
 *
 * ⛔ EACH TARGET'S ACTOR IS ASKED TOO. A save's `StatisticCheck.roll` finds the roller's own token with
 * `actor.getActiveTokens(true, true)`, synchronously at its start, and Foundry answers that only from the
 * scene being viewed. Measured 2026-09-15 with the GM on another scene: the save card then recorded no
 * `target.token`, and a LINKED token's card named the GM's scene, so nothing could tie the save to the
 * creature that rolled it. Only a request for documents (`document === true`) is answered; any other
 * call goes to Foundry's own method, because a caller wanting canvas tokens would get documents it
 * cannot draw.
 *
 * ⛔ PUT BACK IN A `finally`. An answer left in place would aim every later apply the GM makes by hand at
 * the automation's last target.
 *
 * ⚠️ OWN properties shadowing the prototype's methods, removed afterwards in reverse order, so nothing of
 * PF2e's or Foundry's is ever replaced, and two tokens of one linked actor unwind cleanly.
 */
export type TargetToken = object;

export interface AimableUser {
  getActiveTokens?: () => readonly TargetToken[];
}

type ActorTokens = (linked?: boolean, document?: boolean) => readonly unknown[];

interface AimableActor {
  getActiveTokens?: ActorTokens;
}

/** Shadows `key` on `owner` with `value`, returning what puts it back. */
function shadow<T extends object, K extends keyof T>(owner: T, key: K, value: T[K]): () => void {
  const hadOwn = Object.prototype.hasOwnProperty.call(owner, key);
  const own = owner[key];
  owner[key] = value;
  return () => {
    if (hadOwn) {
      owner[key] = own;
    } else {
      Reflect.deleteProperty(owner, key);
    }
  };
}

export function aimAt(user: AimableUser, tokens: readonly TargetToken[], click: () => void): void {
  const undo = [shadow(user, 'getActiveTokens', () => [...tokens])];
  for (const token of tokens) {
    const actor = (token as { readonly actor?: AimableActor | null }).actor;
    const foundry = actor?.getActiveTokens;
    if (actor && foundry) {
      undo.push(
        shadow(actor, 'getActiveTokens', (linked?: boolean, document?: boolean) =>
          document === true ? [token] : foundry.call(actor, linked, document)
        )
      );
    }
  }
  try {
    click();
  } finally {
    for (const put of undo.reverse()) {
      put();
    }
  }
}
