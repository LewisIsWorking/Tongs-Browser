/**
 * What asking for a sheet can come to. Extracted from `CreationRelay` 2026-09-06, when the sender
 * proof needed the room.
 *
 * ⚠️ A separate module rather than a type exported from the class file, matching
 * `SheetCreationTypes`. `CreateSheetRoute` wants the vocabulary and not the relay, and importing a
 * class module to name a union drags a whole transport in behind it.
 *
 * ⚠️ Five outcomes and not "ok plus a message", because a player cannot act on the difference
 * otherwise. Refused means a GM heard and said no. `noGm` means nobody could have. `noSocket` means
 * this client cannot ask at all. `timedOut` means somebody may well be making it right now. They
 * lead to four different next actions, so they stay four different things.
 */
export type CreationOutcome =
  | { readonly kind: 'created'; readonly actorUuid: string | null }
  | { readonly kind: 'refused'; readonly reason: string }
  | { readonly kind: 'noGm' }
  | { readonly kind: 'noSocket' }
  | { readonly kind: 'timedOut' };

/**
 * What can come back once a GM actually has the request. The other three never reached one.
 *
 * ⚠️ The NARROWED union is deliberate. The wider type forced a `reason` fallback for `noGm`,
 * `noSocket` and `timedOut`, none of which the GM side can produce: those describe a request that
 * never reached a GM. That fallback was a branch nothing could reach and no honest test could cover.
 * Saying so in the type deletes it, and makes a future outcome that genuinely can occur there a
 * compile error rather than a silent default.
 */
export type PerformOutcome = Extract<CreationOutcome, { kind: 'created' } | { kind: 'refused' }>;
