import { MODULE_ID } from '../constants.js';
import { buildDualClass } from './buildDualClass.js';
import type { ClassSource } from './buildDualClass.js';
import { CLASS_PACKS, DUAL_FOR_FLAG, packOf } from './dualClassRequest.js';
import type { DualClassRequest, DualClassResult } from './dualClassRequest.js';

/**
 * The GM's browser answering dual class requests. Added 2026-10-12, shaped like `welcome/SheetRequests`.
 *
 * ⛔ Only the designated GM (`game.users.activeGM`) serves, so two GMs online answer once.
 * ⛔ One pass at a time: the answer fires `updateUser`, which calls this again mid-pass. That call
 *    becomes one more pass afterwards, never a second one alongside.
 * ⛔ Every check is made HERE, not only in the player's window, because any player can write the flag:
 *    the sheet exists and the asker owns it, both classes come from a class compendium this world has,
 *    and they are two different classes. Since 2026-10-20 the sheet must not have a dual class already,
 *    Tongs' or the community macro's (`isDualClass`).
 */
export interface PendingDualClass {
  readonly userId: string;
  readonly userName: string;
  readonly request: DualClassRequest;
}

/** A class as the GM's browser loaded it from its compendium. */
export interface LoadedClass extends ClassSource {
  readonly type: string;
}

export interface DualClassPorts {
  readonly isDesignatedGm: () => boolean;
  /** Players (never GMs) with a dual class request on their user. */
  readonly pending: () => readonly PendingDualClass[];
  /** The world's actor by id, and whether this user owns it, or null when there is no such sheet. */
  readonly sheet: (
    actorId: string,
    userId: string
  ) => { readonly name: string; readonly owned: boolean; readonly dualClass?: string } | null;
  readonly packPresent: (key: string) => boolean;
  readonly loadClass: (uuid: string) => Promise<LoadedClass | null>;
  /** The macro's picture, under this world's system. */
  readonly img: () => string;
  /** Clears the request and writes the answer, on the player's user, in one update. */
  readonly answer: (userId: string, result: DualClassResult) => Promise<void>;
  readonly tellGm: (text: string) => void;
}

const SAME = 'Pick two different classes: the same class twice is not a dual class.';

export class DualClassRequests {
  private running = false;
  private again = false;

  public constructor(private readonly ports: DualClassPorts) {}

  public async serve(): Promise<void> {
    if (!this.ports.isDesignatedGm()) {
      return;
    }
    if (this.running) {
      this.again = true;
      return;
    }
    this.running = true;
    try {
      do {
        this.again = false;
        for (const user of this.ports.pending()) {
          await this.serveOne(user);
        }
      } while (this.askedAgain());
    } finally {
      this.running = false;
    }
  }

  /** A method, not a field read: the compiler cannot see the hooks that set it while a pass awaits. */
  private askedAgain(): boolean {
    return this.again;
  }

  private async serveOne(user: PendingDualClass): Promise<void> {
    const { request } = user;
    const outcome = await this.build(user);
    if (typeof outcome === 'string') {
      await this.ports.answer(user.userId, {
        kind: 'refused',
        requestId: request.id,
        reason: outcome,
      });
      return;
    }
    const item = {
      ...buildDualClass(outcome.first, outcome.second, this.ports.img()),
      flags: { [MODULE_ID]: { [DUAL_FOR_FLAG]: request.id } },
    };
    await this.ports.answer(user.userId, {
      kind: 'built',
      requestId: request.id,
      actorId: request.actorId,
      item,
    });
    this.ports.tellGm(
      `Tongs gave ${user.userName}'s ${outcome.sheet} the ${item.name} dual class.`
    );
  }

  /** Both classes and the sheet's name, or why not, in words the player is shown. */
  private async build(
    user: PendingDualClass
  ): Promise<string | { sheet: string; first: LoadedClass; second: LoadedClass }> {
    const { request } = user;
    const sheet = this.ports.sheet(request.actorId, user.userId);
    if (sheet === null) {
      return 'That character sheet is not in this world any more.';
    }
    if (!sheet.owned) {
      return 'You can only give a dual class to a character sheet you own.';
    }
    if (sheet.dualClass !== undefined) {
      return `${sheet.name} already has a dual class (${sheet.dualClass}), so Tongs did not add another.`;
    }
    if (request.first === request.second) {
      return SAME;
    }
    const first = await this.load(request.first);
    if (typeof first === 'string') {
      return first;
    }
    const second = await this.load(request.second);
    if (typeof second === 'string') {
      return second;
    }
    if (first.name.trim().toLowerCase() === second.name.trim().toLowerCase()) {
      return SAME;
    }
    return { sheet: sheet.name, first, second };
  }

  private async load(uuid: string): Promise<LoadedClass | string> {
    const pack = packOf(uuid);
    if (pack === null || !CLASS_PACKS.includes(pack)) {
      return 'That class is not from a class compendium Tongs reads.';
    }
    if (!this.ports.packPresent(pack)) {
      return `This world does not have the ${pack} compendium any more.`;
    }
    const loaded = await this.ports.loadClass(uuid);
    return loaded?.type === 'class'
      ? loaded
      : "Tongs could not find that class in this world's compendiums.";
  }
}
