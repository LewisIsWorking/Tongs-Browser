/**
 * Making sense of what Foundry says when a harness tries to join a world. Added 2026-08-13.
 *
 * ⚠️ THE FAILURE THIS EXISTS FOR. The join used to call `res.json()` inside the page, and every live
 * harness in this repo died with:
 *
 *     page.evaluate: SyntaxError: Unexpected token 'J', "JOIN.Error"... is not valid JSON
 *
 * Foundry answers a refused join with a bare localization key rather than JSON, so the parse threw
 * and took the server's actual complaint with it. What reached the operator described how the reply
 * had disappointed a parser, and said nothing about the world, the user, or the password - and the
 * real answer was sitting in the body the parser had just been handed.
 *
 * Splitting "bytes arrived" from "bytes are usable" is the whole fix. A failure has to say WHOSE
 * fault it is, and these three outcomes have three different owners: the harness is wrong, the
 * operator's credentials are wrong, or Foundry itself refused for a reason it will state.
 */
export interface JoinReply {
  readonly status: number;
  readonly body: string;
}

export type JoinOutcome =
  { readonly kind: 'joined' } | { readonly kind: 'refused'; readonly message: string };

/**
 * Foundry's prefix for a join refusal it has localized. Matching the PREFIX rather than a specific
 * key deliberately: the exact key varies by cause and by Foundry version, and any of them means the
 * same thing to a harness operator.
 */
const LOCALIZED_REFUSAL = 'JOIN.Error';

/** Long enough to carry Foundry's message, short enough to stay readable in a terminal. */
const BODY_EXCERPT = 200;

/**
 * Decide what happened, and say it in terms of what to do about it.
 *
 * ⚠️ Never throws. A function whose job is to explain a failure must not be able to fail: the whole
 * point is that the caller already has bad news and needs it phrased, not a second exception thrown
 * from inside the explanation.
 */
export function interpretJoinReply(reply: JoinReply): JoinOutcome {
  let parsed: { status?: unknown; message?: unknown } | null;
  try {
    parsed = JSON.parse(reply.body) as { status?: unknown; message?: unknown };
  } catch {
    parsed = null;
  }

  if (parsed === null) {
    return { kind: 'refused', message: describeUnparseable(reply) };
  }
  if (parsed.status === 'success') {
    return { kind: 'joined' };
  }
  return {
    kind: 'refused',
    message:
      typeof parsed.message === 'string' ? parsed.message : reply.body.slice(0, BODY_EXCERPT),
  };
}

/**
 * A reply that is not JSON at all, described by what it says rather than by what it is not.
 *
 * ⚠️ The password hint is attached only to the localized refusal, not to every unparseable body. A
 * hint offered indiscriminately is noise on the occasions it is wrong, and the occasion it would be
 * wrong here is the interesting one: an HTML error page means something else entirely is answering
 * on that port.
 */
function describeUnparseable(reply: JoinReply): string {
  const excerpt = reply.body.slice(0, BODY_EXCERPT).trim();
  const base = `Foundry answered HTTP ${String(reply.status)} with a reply that is not JSON: ${excerpt}`;

  if (excerpt.startsWith(LOCALIZED_REFUSAL)) {
    return `${base}\nThat is Foundry refusing the join. If the user has a password, set FOUNDRY_PASSWORD before running this.`;
  }
  return `${base}\nA reply in this shape usually means something other than Foundry is answering on that port.`;
}
