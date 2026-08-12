import { describe, expect, it } from 'vitest';

import { describeDragPermissions } from '../../src/debug/FoundryProbes.js';

/**
 * Asking Foundry's interaction manager whether it would ALLOW a drag.
 *
 * ⚠️ This suite exists because the function shipped with none, and a device then reported
 * `dragLeftStart=unaskable`, a word that says the probe threw and nothing whatever about why. A
 * diagnostic whose failure mode is a single opaque token is not a diagnostic; it is a second round
 * trip to a phone.
 */
const managerThatAnswers = (answers: Record<string, boolean>) => ({
  mouseInteractionManager: {
    can: (action: string) => {
      const answer = answers[action];
      if (answer === undefined) {
        throw new Error(`Cannot read properties of undefined (reading 'interactionData')`);
      }
      return answer;
    },
  },
});

describe('asking about drag permissions', () => {
  it('reports every action it asked about', () => {
    const target = managerThatAnswers({ clickLeft: true, dragStart: true, dragLeftStart: true });

    expect(describeDragPermissions(target)).toBe(
      'clickLeft=true dragStart=true dragLeftStart=true'
    );
  });

  it('reports a refusal as plainly as a permission', () => {
    const target = managerThatAnswers({ clickLeft: true, dragStart: true, dragLeftStart: false });

    expect(describeDragPermissions(target)).toContain('dragLeftStart=false');
  });

  /**
   * ⚠️ The exact failure a device reported. The first two answer and the third throws, so the line
   * has to carry both kinds of result at once rather than degrading to a single verdict.
   */
  it('names WHY a check could not be asked, not merely that it could not', () => {
    const target = managerThatAnswers({ clickLeft: true, dragStart: true });

    const described = describeDragPermissions(target);

    expect(described).toContain('clickLeft=true');
    expect(described).toContain('dragLeftStart=unaskable(Cannot read properties of undefined');
  });

  /** A thrown non-Error still has to produce a line, because a report that throws reports nothing. */
  it('survives a throw that is not an Error', () => {
    const target = {
      mouseInteractionManager: {
        can: () => {
          // eslint-disable-next-line @typescript-eslint/only-throw-error -- the POINT is a non-Error
          throw 'no';
        },
      },
    };

    expect(describeDragPermissions(target)).toBe(
      'clickLeft=unaskable(no) dragStart=unaskable(no) dragLeftStart=unaskable(no)'
    );
  });

  /**
   * ⚠️ Truncated, because these lines are read on a phone. An unbounded message from somebody
   * else's code can be a paragraph, and a report nobody can read is the same as no report.
   */
  it('truncates a message too long to read on a phone', () => {
    const target = {
      mouseInteractionManager: {
        can: () => {
          throw new Error('x'.repeat(500));
        },
      },
    };

    expect(describeDragPermissions(target)).toContain(`clickLeft=unaskable(${'x'.repeat(60)})`);
  });

  it('says plainly when there is no manager to ask', () => {
    expect(describeDragPermissions({})).toBe('no manager to ask');
    expect(describeDragPermissions(undefined)).toBe('no manager to ask');
  });
});
