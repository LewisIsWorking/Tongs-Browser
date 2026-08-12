import { describe, expect, it } from 'vitest';

import { toPlainText } from '../../src/debug/DiagnosticsReport.js';

describe('toPlainText', () => {
  /**
   * The clipboard copy exists because reading a report off a phone screenshot truncates it, so the
   * plain form has to keep every line break the markup was providing.
   */
  it('turns line break markup into real newlines and drops the rest', () => {
    expect(toPlainText(['<strong>a</strong>', '<code>b</code><br><code>c</code>'])).toBe('a\nb\nc');
  });
});
