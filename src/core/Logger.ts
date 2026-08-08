import { MODULE_TITLE } from '../constants.js';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Every message this module writes goes through here so console output stays greppable in a busy
 * Foundry log, and so debug chatter can be silenced without hunting down scattered console calls.
 *
 * Debug output is off unless explicitly enabled, because the pointer engine can emit events on
 * every animation frame and an unguarded log would flood the console on a phone.
 */
export class Logger {
  private debugEnabled = false;

  public constructor(private readonly prefix: string = MODULE_TITLE) {}

  public setDebugEnabled(enabled: boolean): void {
    this.debugEnabled = enabled;
  }

  public isDebugEnabled(): boolean {
    return this.debugEnabled;
  }

  public debug(message: string, ...details: unknown[]): void {
    if (!this.debugEnabled) {
      return;
    }
    this.write('debug', message, details);
  }

  public info(message: string, ...details: unknown[]): void {
    this.write('info', message, details);
  }

  public warn(message: string, ...details: unknown[]): void {
    this.write('warn', message, details);
  }

  public error(message: string, ...details: unknown[]): void {
    this.write('error', message, details);
  }

  /** Exposed so tests can assert on formatting without capturing console output. */
  public format(message: string): string {
    return `${this.prefix} | ${message}`;
  }

  private write(level: LogLevel, message: string, details: unknown[]): void {
    const formatted = this.format(message);

    if (level === 'error') {
      console.error(formatted, ...details);
      return;
    }
    if (level === 'warn') {
      console.warn(formatted, ...details);
      return;
    }

    /*
     * This class is the single sanctioned console call site in the module. Routing info and debug
     * through console.warn would misreport severity in the Foundry log and in Chrome remote
     * debugging, which is the main tool for diagnosing this module on a physical device.
     */
    // eslint-disable-next-line no-console
    console.log(formatted, ...details);
  }
}

/** Shared instance. Modules should import this rather than constructing their own. */
export const logger = new Logger();
