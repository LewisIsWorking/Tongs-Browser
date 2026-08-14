/**
 * Turning a user's NAME into the id Foundry's /join endpoint wants.
 * Written 2026-08-14, measured against a live 14.366.
 *
 * ⚠️ WHAT 14.366 CHANGED, and it is one character. The join POST body is now:
 *
 *     {"username":"Gamemaster","password":"…","action":"join","userId":"7PaKtYhGyjFH11Zw"}
 *
 * `userId`, not `userid`. The old key is not rejected, it is IGNORED, so the server sees a request
 * with no user in it and answers `JOIN.ErrorUserDoesNotExist` - which reads as "your world has no
 * such user" when the user is right there. Captured by intercepting what the real form sends rather
 * than by guessing, after three hand-built payloads were all refused identically.
 *
 * ⚠️ WHERE THE NAMES COME FROM ALSO CHANGED. Up to 14.365 the page held a `<select name="userid">`
 * and the harness read its options. 14.366 renders `<input type="text" name="username">` with custom
 * autocompletion and **no user list in the DOM at all** - no select, no datalist, no data attribute.
 * A selector-based fix would have had nothing to select.
 *
 * `game.users` is present on the join page in both, which is where the page's own autocomplete gets
 * them, so that is what this reads. The `<select>` is kept as a fallback for older servers.
 */

/** A user as the join page exposes it. */
export interface JoinUser {
  readonly id: string;
  readonly name: string;
}

/**
 * The id for a name, or null.
 *
 * ⚠️ Case-insensitive and trimmed. `FOUNDRY_USER` is typed by a human into a shell, and 14.366's
 * field is free text rather than a list to pick from, so an exact-match rule now fails on a
 * capitalisation nobody would notice.
 */
export function resolveUserId(users: readonly JoinUser[], name: string): string | null {
  const wanted = name.trim().toLowerCase();
  return users.find((user) => user.name.trim().toLowerCase() === wanted)?.id ?? null;
}

/**
 * Why the name did not resolve, said in terms of what the world actually offers.
 *
 * ⚠️ An empty list and an absent name are different findings. Empty means the page had not finished
 * rendering or this Foundry keeps its users somewhere new; a populated list means the name is simply
 * wrong. The old message collapsed both into "This world offers: " with nothing after the colon.
 */
export function describeMissingUser(users: readonly JoinUser[], name: string): string {
  if (users.length === 0) {
    return (
      `could not read any users from the join page. On 14.366 the user list is not in the DOM at ` +
      `all - it comes from game.users - so either the page had not finished loading, or this ` +
      `Foundry exposes them somewhere this harness does not look.`
    );
  }
  const offered = users.map((user) => user.name).join(', ');
  return `no user named '${name}'. This world offers: ${offered}`;
}

/**
 * The body the /join endpoint expects, carrying BOTH spellings of the id.
 *
 * ⚠️ Both on purpose. 14.366 reads `userId` and 14.365 reads `userid`, neither complains about the
 * other, and a harness that has to work across an upgrade should not need to know which side of it
 * the server is on. `username` is included because 14.366's own form sends it.
 */
export function buildJoinBody(userId: string, name: string, password: string) {
  return { action: 'join', userId, userid: userId, username: name, password };
}
