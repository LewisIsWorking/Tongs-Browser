import { afterEach, describe, expect, it, vi } from 'vitest';

import { Logger } from '../../src/core/Logger.js';

describe('Logger', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prefixes messages so module output is greppable in a busy Foundry log', () => {
    const logger = new Logger('Tongs Browser');
    expect(logger.format('Pointer engine started.')).toBe(
      'Tongs Browser | Pointer engine started.'
    );
  });

  it('uses a custom prefix when one is supplied', () => {
    const logger = new Logger('Gesture');
    expect(logger.format('Entered DRAGGING.')).toBe('Gesture | Entered DRAGGING.');
  });

  it('suppresses debug output by default', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const logger = new Logger();

    logger.debug('Synthesised pointermove.');

    expect(logger.isDebugEnabled()).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });

  it('emits debug output once enabled', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const logger = new Logger();

    logger.setDebugEnabled(true);
    logger.debug('Synthesised pointermove.', { x: 10, y: 20 });

    expect(logger.isDebugEnabled()).toBe(true);
    expect(spy).toHaveBeenCalledWith('Tongs Browser | Synthesised pointermove.', { x: 10, y: 20 });
  });

  it('routes warnings and errors to their matching console channels', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const logger = new Logger();

    logger.warn('Foundry ignored a synthetic key event.');
    logger.error('Canvas unavailable.');

    expect(warnSpy).toHaveBeenCalledWith('Tongs Browser | Foundry ignored a synthetic key event.');
    expect(errorSpy).toHaveBeenCalledWith('Tongs Browser | Canvas unavailable.');
  });

  it('keeps info output off the warn channel so severity is not misreported', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const logger = new Logger();

    logger.info('Ready.');

    expect(logSpy).toHaveBeenCalledOnce();
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
