import { describe, expect, it, vi } from 'vitest';

import { describeDragPermissions } from '../../src/debug/DragPermissions.js';

/**
 * Asking Foundry's interaction manager whether it would ALLOW a drag.
 *
 * ⚠️ This suite exists because the function shipped with none, and a device then reported
 * `dragLeftStart=unaskable`, a word that says the probe threw and nothing whatever about why. A
 * diagnostic whose failure mode is a single opaque token is not a diagnostic; it is a second round
 * trip to a phone.
 */
type DragLeftStart = (user: unknown, event: unknown, options: { notify: boolean }) => boolean;

const target = (answers: Record<string, boolean>, dragLeftStart?: DragLeftStart) => ({
  mouseInteractionManager: {
    can: (action: string) => {
      const answer = answers[action];
      if (answer === undefined) {
        throw new Error("Cannot read properties of undefined (reading 'interactionData')");
      }
      return answer;
    },
  },
  ...(dragLeftStart === undefined ? {} : { _canDragLeftStart: dragLeftStart }),
});

describe('asking about drag permissions', () => {
  it('reports every action it asked about', () => {
    const described = describeDragPermissions(
      target({ clickLeft: true, dragStart: true }, () => true)
    );

    expect(described).toBe('clickLeft=true dragStart=true dragLeftStart=true');
  });

  it('reports a refusal as plainly as a permission', () => {
    const described = describeDragPermissions(
      target({ clickLeft: true, dragStart: true }, () => false)
    );

    expect(described).toContain('dragLeftStart=false');
  });
});

describe('asking without disturbing the session', () => {
  /**
   * ⚠️ SILENT, and this is the whole reason `dragLeftStart` is asked through the object rather than
   * through `can`. Foundry's signature is `_canDragLeftStart(user, event, {notify=true}={})`, and
   * every refusal path inside it calls `ui.notifications.warn` when notify is left alone. `can` has
   * no way to pass it through, so asking the obvious way pops a toast on the player's screen every
   * time they press the diagnose button. A diagnostic that changes what the user sees is not
   * reporting on the session any more, it is part of it.
   */
  it('passes notify false, so a refusal never warns the player', () => {
    const ask = vi.fn(() => false);

    describeDragPermissions(target({ clickLeft: true, dragStart: true }, ask));

    expect(ask).toHaveBeenCalledWith(undefined, expect.anything(), { notify: false });
  });

  /**
   * ⚠️ The probe carries an EMPTY interactionData, which is the field the check was measured to read:
   * `event.interactionData.object?.mouseInteractionManager`. Empty is the honest value, because
   * nothing is being previewed while a report is assembled. A populated one would answer a question
   * about a drag that is not happening.
   */
  it('supplies the one field the check reads, and no more', () => {
    let seen: unknown = null;
    const ask: DragLeftStart = (_user, event) => {
      seen = event;
      return true;
    };

    describeDragPermissions(target({ clickLeft: true, dragStart: true }, ask));

    expect(seen).toEqual({ type: 'pointermove', button: 0, interactionData: {} });
  });
});

describe('when a check cannot be asked', () => {
  /** The exact failure a device reported: two answer and the third cannot. */
  it('names WHY, not merely that it could not', () => {
    const described = describeDragPermissions(target({ clickLeft: true, dragStart: true }));

    expect(described).toContain('clickLeft=true');
    expect(described).toContain('dragLeftStart=unaskable(no _canDragLeftStart on the placeable)');
  });

  it('reports a thrown non-Error, because a report that throws reports nothing', () => {
    const described = describeDragPermissions({
      mouseInteractionManager: {
        can: () => {
          // eslint-disable-next-line @typescript-eslint/only-throw-error -- the POINT is a non-Error
          throw 'no';
        },
      },
    });

    expect(described).toContain('clickLeft=unaskable(no)');
  });

  /**
   * ⚠️ Truncated, because these lines are read on a phone. An unbounded message from somebody else's
   * code can be a paragraph, and a report nobody can read is the same as no report.
   */
  it('truncates a message too long to read on a phone', () => {
    const described = describeDragPermissions({
      mouseInteractionManager: {
        can: () => {
          throw new Error('x'.repeat(500));
        },
      },
    });

    expect(described).toContain(`clickLeft=unaskable(${'x'.repeat(60)})`);
  });

  it('says plainly when there is no manager to ask', () => {
    expect(describeDragPermissions({})).toBe('no manager to ask');
    expect(describeDragPermissions(undefined)).toBe('no manager to ask');
  });
});
