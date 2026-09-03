import type { CreationOutcome } from '../relay/CreationRelay.js';
import type {
  CreatedSheet,
  CreationRequest,
  SheetCreationOutcome,
} from '../foundry/SheetCreationTypes.js';
import { RELAY_REASONS } from './CreateSheetMessages.js';

/**
 * Which way a create goes, and how the answer is phrased. Added 2026-09-03.
 *
 * ⚠️ The FLOW does not know which route was taken, and that is the point of putting the choice here.
 * `CreateSheetFlow` asks which party, asks whose, and calls one `create` port. Teaching it that a
 * player takes a different path would mean every future change to the pickers reasoning about GM-ness
 * again, and the routing rule lives in exactly one place instead of being re-derived at each step.
 *
 * ⚠️ A GM goes DIRECT even when a socket exists. Not an optimisation: a GM can already do the whole
 * operation, so asking somebody else to do it introduces a round trip that can time out, and a solo
 * GM has nobody to ask at all.
 */
export interface CreateRouteDeps {
  readonly isGm: () => boolean;
  /** The GM's own path, straight to Foundry. */
  readonly direct: (request: CreationRequest) => Promise<SheetCreationOutcome>;
  /** The player's path, which asks a GM and waits for an answer. */
  readonly viaRelay: (partyUuid: string, name: string) => Promise<CreationOutcome>;
  /**
   * Turn the uuid a GM sent back into something openable.
   *
   * ⚠️ A player CAN resolve it: they were made its owner, so Foundry sends them the document. If it
   * does not resolve, the sheet still exists and the honest answer is "made, cannot open it", never a
   * failure that invites a second attempt and a duplicate.
   */
  readonly resolveSheet: (uuid: string) => Promise<CreatedSheet | null>;
}

export function routeCreate(
  deps: CreateRouteDeps
): (request: CreationRequest) => Promise<SheetCreationOutcome> {
  return async (request) => {
    if (deps.isGm()) {
      return deps.direct(request);
    }
    return asSheetOutcome(await deps.viaRelay(request.partyUuid, request.name), deps);
  };
}

async function asSheetOutcome(
  outcome: CreationOutcome,
  deps: CreateRouteDeps
): Promise<SheetCreationOutcome> {
  switch (outcome.kind) {
    case 'created':
      return openable(outcome.actorUuid, deps);
    case 'refused':
      return { kind: 'notCreated', reason: outcome.reason };
    /*
     * ⚠️ Three different reasons, not one "it failed". Each names a different thing to do: wait for a
     * GM, check the connection, or try again. Collapsing them would leave a player with a dead button
     * and no idea which.
     */
    case 'noGm':
      return { kind: 'notCreated', reason: RELAY_REASONS.noGm };
    case 'noSocket':
      return { kind: 'notCreated', reason: RELAY_REASONS.noSocket };
    case 'timedOut':
      return { kind: 'notCreated', reason: RELAY_REASONS.timedOut };
  }
}

/**
 * ⚠️ A sheet that exists but cannot be opened is `createdOutsideParty`, which reads oddly until you
 * see what that outcome is FOR: the sheet exists and something about it is not what was asked for.
 * The flow reports it and does not invite a retry, which is exactly the handling this case needs.
 */
async function openable(
  actorUuid: string | null,
  deps: CreateRouteDeps
): Promise<SheetCreationOutcome> {
  if (actorUuid === null) {
    return { kind: 'createdOutsideParty', sheet: {}, reason: RELAY_REASONS.madeButUnknown };
  }

  const sheet = await deps.resolveSheet(actorUuid);
  if (sheet === null) {
    return {
      kind: 'createdOutsideParty',
      sheet: { uuid: actorUuid },
      reason: RELAY_REASONS.madeButUnreachable,
    };
  }
  return { kind: 'created', sheet };
}
