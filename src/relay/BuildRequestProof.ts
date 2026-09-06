import { MODULE_ID } from '../constants.js';
import { CLAIM_FLAG, type ProofPorts } from './RequestProof.js';

/**
 * The real Foundry behind the creation relay's sender proof. Added 2026-09-06.
 *
 * ⚠️ Its own file for the same reason as `BuildCreationRelay`: everything here needs a world, and
 * keeping it apart means `RequestProof` and `CreationRelay` stay drivable entirely through fakes.
 *
 * ⚠️ Globals read LAZILY on every call. A user can connect or drop mid-session, and a proof read
 * against a snapshot taken at startup would be answering about a world that has moved on.
 *
 * ⛔ THIS FILE IS ON THE `check-document-access` BOUNDARY LIST, and it is the one entry that does not
 * enumerate. It resolves ONE user, by an id already in hand, and reads a single flag off them. It
 * lists nothing, filters nothing and renders nothing: the value never reaches the screen, it is
 * compared for equality and thrown away. The guard's real obligation, never show a player a document
 * they cannot see, is met by there being no output at all.
 */

interface FlagUser {
  getFlag?: (scope: string, key: string) => unknown;
  setFlag?: (scope: string, key: string, value: unknown) => Promise<unknown>;
  unsetFlag?: (scope: string, key: string) => Promise<unknown>;
}

interface ProofGame {
  readonly user?: FlagUser;
  readonly users?: { readonly get?: (id: string) => FlagUser | undefined };
}

export function buildRequestProof(): ProofPorts {
  return {
    claim: async (requestId) => {
      /*
       * ⚠️ Written to `game.user`, this client's OWN user, and there is no code path here that could
       * write to another. That is the entire proof: the server accepts this precisely because the
       * document is the caller's, and would refuse the same write aimed anywhere else.
       */
      await gameOf()?.user?.setFlag?.(MODULE_ID, CLAIM_FLAG, requestId);
    },

    readClaim: (userId) => {
      const claimed = gameOf()?.users?.get?.(userId)?.getFlag?.(MODULE_ID, CLAIM_FLAG);
      /*
       * ⚠️ Anything that is not a string becomes null rather than being coerced. A flag is ordinary
       * document data and a hostile client may put an object or a number there; `String(claimed)`
       * would turn that into a value that could conceivably match something.
       */
      return typeof claimed === 'string' ? claimed : null;
    },

    release: async (userId) => {
      /*
       * ⚠️ Run on the GM's client, against the REQUESTER's document, which is allowed because a full
       * GM passes `#canUpdate` for any user. A player clearing their own claim would work too and
       * would be useless: the client that must not be able to replay is the one that is lying.
       */
      await gameOf()?.users?.get?.(userId)?.unsetFlag?.(MODULE_ID, CLAIM_FLAG);
    },
  };
}

function gameOf(): ProofGame | undefined {
  return (globalThis as { game?: ProofGame }).game;
}
