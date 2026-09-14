/**
 * Borrowing the GM's token selection, and giving it back. Added 2026-09-13.
 *
 * PF2e's apply and save controls act on the CONTROLLED tokens. The deck aims them by selecting the
 * tokens it means, running PF2e's control, then putting back exactly what the GM had selected.
 * Extracted from `applyThroughSystem` when rolling saves needed the same.
 */
export interface TokenLike {
  readonly control: (options: { releaseOthers: boolean }) => unknown;
  readonly release: () => unknown;
}

/** Selects exactly these tokens: the first releases whatever else was selected. */
export function selectOnly(tokens: readonly TokenLike[]): void {
  tokens.forEach((token, index) => {
    token.control({ releaseOthers: index === 0 });
  });
}

/**
 * ⚠️ Releases what is controlled NOW, then re-controls what was controlled BEFORE. Restoring by
 * releasing only the borrowed tokens would leave anything PF2e selected meanwhile still selected.
 */
export function restoreSelection(
  controlledNow: readonly TokenLike[],
  previous: readonly TokenLike[]
): void {
  for (const token of [...controlledNow]) {
    token.release();
  }
  for (const token of previous) {
    token.control({ releaseOthers: false });
  }
}
