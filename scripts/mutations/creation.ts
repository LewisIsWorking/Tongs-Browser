import type { RecordedMutation } from './shape.ts';

/**
 * Defects on the SHEET CREATION path: who may create, in which party, owned by whom, and served by
 * which GM. Split from `recorded.ts` 2026-09-08 when it crossed the size limit.
 *
 * ⚠️ They share a property that is the reason they are recorded rather than merely tested: each
 * runs on a GM's CLIENT, where Foundry refuses nothing, so our check is the only check there is.
 */
export const CREATION_MUTATIONS: readonly RecordedMutation[] = [
  {
    file: 'src/ui/PartyAccessFlow.ts',
    find: '  const party = ports.readParties().find((candidate) => candidate.uuid === uuid);',
    replace: '  const party = ports.readParties()[0];',
    /*
     * ⚠️ Subtler than "writes to the wrong party", and that is why it survived eleven tests. The uuid
     * written is always the tapped one, so this does not misdirect the write. It takes the DIRECTION
     * from the wrong party and names the wrong party in the confirmation: tapping a closed party
     * would close an open one and announce it about a third. Two fixtures in the SAME state cannot
     * see it, and the first attempt at the test that closes this used two closed parties.
     */
    defect: 'acts on the first party in the list rather than the one tapped',
    tests: ['tests/dom/partyAccessFlow.test.ts'],
  },
  {
    file: 'src/ui/PartyAccessFlow.ts',
    find: '  const wanted = !party.playerCreationEnabled;',
    replace: '  const wanted = party.playerCreationEnabled;',
    defect: 'the switch reasserts the current state instead of flipping it',
    tests: ['tests/dom/partyAccessFlow.test.ts', 'tests/dom/partyAccessRace.test.ts'],
  },
  {
    file: 'src/ui/PartyAccessFlow.ts',
    find: '    ports.report(ACCESS_NOTICES.vanished.message);',
    replace: '    void 0;',
    /*
     * ⚠️ The guard still returns, so nothing breaks and nothing is written. It just says nothing,
     * which on a phone is indistinguishable from a tap that missed the button.
     */
    defect: 'a party deleted under the list fails silently',
    tests: ['tests/dom/partyAccessRace.test.ts'],
  },
  /*
   * ⚠️ The four below guard code that runs on a GM's CLIENT, where Foundry refuses nothing. Elsewhere
   * in this module our checks are a second line behind Foundry's own enforcement; on this path they
   * are the only line, so each one is recorded rather than merely tested.
   */
  {
    file: 'src/relay/CreationPolicy.ts',
    find: '  if (!party.playerCreationEnabled) {',
    replace: '  if (party.playerCreationEnabled) {',
    defect: 'players may create in the parties the GM CLOSED, and not the open ones',
    tests: ['tests/unit/creationPolicy.test.ts'],
  },
  {
    file: 'src/relay/CreationPolicy.ts',
    find: '  const owner = world.users.find((user) => user.id === request.userId);',
    replace: '  const owner = world.users[0];',
    defect: 'any requester is treated as the first user in the world',
    tests: ['tests/unit/creationPolicy.test.ts'],
  },
  {
    file: 'src/relay/CreationPolicy.ts',
    find: '  return trimmed.slice(0, NAME_LIMIT);',
    replace: '  return trimmed;',
    defect: 'a player-supplied name is written into the world uncapped',
    tests: ['tests/unit/creationPolicy.test.ts'],
  },
  /*
   * ⚠️ The three below are consequences of EVERY client receiving EVERY message on the channel. All
   * three fail while looking like success, which is why they are recorded rather than only tested.
   */
  {
    file: 'src/relay/CreationRelay.ts',
    find: '    if (!this.options.readPresence().isMe) {',
    replace: '    if (this.options.readPresence().isMe) {',
    defect: 'every GM but the designated one serves the request, so a table gets one sheet per GM',
    tests: ['tests/unit/creationRelay.test.ts'],
  },
  {
    file: 'src/relay/CreationRelay.ts',
    find: '    const made = await this.options.create(verdict.ownerId, verdict.partyUuid, verdict.name);',
    replace:
      '    const made = await this.options.create(this.options.myUserId(), verdict.partyUuid, verdict.name);',
    defect: 'the sheet is owned by the GM who ran it rather than the player who asked',
    tests: ['tests/unit/creationRelay.test.ts'],
  },
  {
    file: 'src/relay/PendingRequests.ts',
    find: '    const pending = this.waiting.get(id);',
    replace: '    const pending = [...this.waiting.values()][0];',
    defect: 'any answer settles whichever request is outstanding, so a player takes someone else’s',
    tests: ['tests/unit/pendingRequests.test.ts', 'tests/unit/creationRelay.test.ts'],
  },
  {
    file: 'src/foundry/DesignatedGm.ts',
    find: '  const isMe = typeof myId === ' + "'string'" + ' && myId.length > 0 && gm.id === myId;',
    replace: '  const isMe = gm.id === myId;',
    /*
     * ⚠️ The obvious form of this line, and it is wrong in the worst direction. Both sides being
     * `undefined` compares equal, so a client that cannot say who it is decides it is the designated
     * GM and starts acting on everybody else's requests. Silent, and worse the more clients connect.
     */
    defect: 'an unidentifiable client believes it is the designated GM',
    tests: ['tests/unit/designatedGm.test.ts'],
  },
  {
    file: 'src/relay/CreationRelay.ts',
    find: '    const outcome = proves(this.options.proof.readClaim(request.userId), request.requestId)',
    replace: '    const outcome = true',
    /*
     * ⚠️ Recorded rather than merely unit tested, for the same reason `CreationPolicy`'s guards are:
     * on the relay's receiving end our check is not a layer sitting in front of Foundry's own
     * enforcement, it is the ONLY check there is. Core Foundry rebroadcasts a socket payload without
     * a verified sender, so deleting this line restores the original hole exactly: a player names
     * another player's id and the sheet is created owned by them, silently.
     */
    defect:
      'a request is served on a CLAIMED sender id, so a player can create a sheet owned by someone else',
    tests: ['tests/unit/requestProof.test.ts'],
  },
  {
    file: 'src/relay/CreationRelay.ts',
    find: '    await this.options.proof.release(request.userId);',
    replace: '    await Promise.resolve();',
    /*
     * ⚠️ A claim is PUBLIC: every client sees the flag update, so a hostile one can read a real
     * request id off the wire and re-emit the payload verbatim. Without the release that replay
     * verifies perfectly. It cannot buy a sheet for the WRONG person, which is why this is the
     * lesser of the two, but it buys any number of them for the right one.
     */
    defect: 'a served claim is left standing, so a replayed payload creates a duplicate sheet',
    tests: ['tests/unit/requestProof.test.ts'],
  },
  {
    file: 'src/foundry/CreateSheetDeps.ts',
    find: '      return actor.create(data);',
    replace: '      const create = actor.create;\n      return create(data);',
    /*
     * ⛔ THE BUG THAT MEANT CREATION HAD NEVER WORKED IN A REAL FOUNDRY. Recorded 2026-09-12. This
     * is the shape it shipped in: `create` read off `Actor`, then called bare. Foundry's
     * `Document.create` begins `this.implementation...`, so `this` was undefined and every tap of
     * the create button produced a notice and no character.
     *
     * ⛔ Recorded because every OTHER stub in that test file is an arrow function or a `vi.fn`, and
     * neither reads `this`, so a detached call works on them perfectly. Only the one stub shaped like
     * Foundry's real static method notices, and a tidy-up that "simplified" it would hide this again.
     */
    defect: 'Actor.create is called detached, so creating a sheet throws on every real Foundry',
    tests: ['tests/dom/createSheetDeps.test.ts'],
  },
];
