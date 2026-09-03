/**
 * Mutations that MUST still be caught. Added 2026-09-03.
 *
 * Each entry is a defect that was, at some point, invisible to a green build: the code was at full
 * coverage, every test passed, and the wrong version of the line passed too. The test that closes it
 * is recorded here so that weakening that test breaks the build rather than quietly restoring the
 * hole.
 *
 * ⚠️ A coverage ratchet cannot do this job. Coverage asks whether a line RAN. Every mutation below
 * ran the line it changed, at 100% coverage, and still shipped a wrong answer.
 *
 * ⚠️ `find` is EXACT SOURCE TEXT and must appear exactly ONCE in the file. Line numbers were the
 * obvious alternative and are wrong: they rot on the first edit above them, and a stale number
 * mutates an innocent line, which produces a "survivor" that is really a mutation of nothing. An
 * ambiguous anchor is a hard error for the same reason, and it is the specific way a hand-rolled
 * version of this went wrong: `String.replace` silently mutated the first of two identical lines.
 *
 * ⚠️ `tests` must NAME the files to run rather than running everything. Not for speed: a mutation
 * killed by some unrelated test elsewhere is not evidence that the test recorded here still works.
 */
export interface RecordedMutation {
  /** Source file to mutate, repo relative. */
  readonly file: string;
  /** Exact text to replace. Must occur exactly once. */
  readonly find: string;
  /** What to put there instead. */
  readonly replace: string;
  /** What the mutation means, in the words of the bug it would ship. */
  readonly defect: string;
  /** The test files that must notice. */
  readonly tests: readonly string[];
}

export const RECORDED: readonly RecordedMutation[] = [
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
    find: '  if (owner.isGm) {',
    replace: '  if (!owner.isGm) {',
    defect: 'players are refused and GMs are served, exactly backwards',
    tests: ['tests/unit/creationPolicy.test.ts'],
  },
  {
    file: 'src/relay/CreationPolicy.ts',
    find: '  return trimmed.slice(0, NAME_LIMIT);',
    replace: '  return trimmed;',
    defect: 'a player-supplied name is written into the world uncapped',
    tests: ['tests/unit/creationPolicy.test.ts'],
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
];
