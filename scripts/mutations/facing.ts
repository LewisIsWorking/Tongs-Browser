import type { RecordedMutation } from './shape.ts';

/**
 * Default token facing's mutations. Added 2026-11-14.
 *
 * Each is a rule whose loss still mirrors and still rotates, just not the token it should: a GM's own
 * choice of mirror overwritten, a token placed already turned snapped round, or a player's macro
 * rewriting every actor in the world.
 */
export const FACING_MUTATIONS: readonly RecordedMutation[] = [
  {
    file: 'src/facing/tokenFacing.ts',
    find: '  if (isMirrored(requested?.texture?.scaleX) || isMirrored(requested?.texture?.scaleY)) {',
    replace: '  if (isMirrored(requested?.texture?.scaleX)) {',
    defect: 'an actor made with art mirrored top to bottom only is mirrored both ways anyway',
    tests: ['tests/unit/tokenFacing.test.ts'],
  },
  {
    file: 'src/facing/tokenFacing.ts',
    find: '    (token.rotation ?? 0) === 0',
    replace: '    true',
    defect: 'a token placed already turned to face somewhere is snapped round to 180',
    tests: ['tests/unit/tokenFacing.test.ts'],
  },
  {
    file: 'src/facing/startTokenFacing.ts',
    find: '  if (game?.user?.isGM !== true || game.actors === undefined) {',
    replace: '  if (game?.actors === undefined) {',
    defect:
      "a player's macro calling the API rewrites the token facing of every actor it can reach",
    tests: ['tests/unit/applyTokenFacing.test.ts'],
  },
];
