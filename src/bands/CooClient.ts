/**
 * Talking to the ComeOnOverUno server from the GM's browser. Added 2026-09-14.
 *
 * ⛔ NO SECRET LIVES IN THIS FILE. Foundry sends a module's code to every player. Decided with Lewis: the
 * GM signs in to COO once, and only the REFRESH token is kept, in a client setting that exists in that
 * one browser. The password is used once and never stored. The COO endpoint requires the Admin role.
 *
 * ⚠️ COO ROTATES REFRESH TOKENS, so two refreshes at once would spend the same token twice and the second
 * would sign the GM out. Every refresh goes through one shared in-flight promise.
 */
export interface CooPorts {
  readonly fetch: (
    url: string,
    init: { method: string; headers: Record<string, string>; body: string }
  ) => Promise<{ status: number; json: () => Promise<unknown> }>;
  readonly serverUrl: () => string;
  readonly refreshToken: () => string;
  readonly saveRefreshToken: (token: string) => Promise<void>;
  readonly now: () => number;
}

export interface BandPost {
  readonly name: string;
  readonly segments: number;
  readonly word: string;
  readonly hp: number;
  readonly maxHp: number;
  readonly announce: boolean;
  /** For the GM's DM only; COO never puts it on the public line. */
  readonly cause: string;
  /** What hit it, for the topic; present only when players can see the attacker (`attackerView.ts`). */
  readonly publicCause?: string;
  readonly attackerImage?: string;
  /** Present only when players can see the creature's name (`bandSubject.ts`). */
  readonly targetImage?: string;
}

export type PostOutcome = 'sent' | 'signed-out' | 'failed';

interface Tokens {
  readonly accessToken?: unknown;
  readonly refreshToken?: unknown;
  readonly accessTokenExpiresAt?: unknown;
}

/** A minute's margin, so a token about to expire is refreshed rather than sent and refused. */
const EARLY_MS = 60_000;

export class CooClient {
  private readonly ports: CooPorts;
  private access: { token: string; expiresAt: number } | null = null;
  private refreshing: Promise<string | null> | null = null;

  public constructor(ports: CooPorts) {
    this.ports = ports;
  }

  /** True when COO accepted the login and a refresh token was kept. */
  public async signIn(username: string, password: string): Promise<boolean> {
    const response = await this.send('/api/auth/login', { username, password });
    return response.status === 200 && (await this.keep((await response.json()) as Tokens)) !== null;
  }

  public async postBand(campaign: string, post: BandPost): Promise<PostOutcome> {
    for (const attempt of [1, 2]) {
      const token = await this.accessToken(attempt === 2);
      if (token === null) {
        return 'signed-out';
      }
      const response = await this.send(
        `/api/pathwars/campaigns/${encodeURIComponent(campaign)}/combat-band`,
        post,
        token
      );
      if (response.status !== 401) {
        return response.status === 200 ? 'sent' : 'failed';
      }
    }
    return 'signed-out';
  }

  private async accessToken(forceRefresh: boolean): Promise<string | null> {
    if (
      !forceRefresh &&
      this.access !== null &&
      this.access.expiresAt - EARLY_MS > this.ports.now()
    ) {
      return this.access.token;
    }
    this.refreshing ??= this.refresh().finally(() => {
      this.refreshing = null;
    });
    return this.refreshing;
  }

  private async refresh(): Promise<string | null> {
    const refreshToken = this.ports.refreshToken();
    if (refreshToken === '') {
      return null;
    }
    const response = await this.send('/api/auth/refresh', { refreshToken });
    if (response.status !== 200) {
      this.access = null;
      await this.ports.saveRefreshToken('');
      return null;
    }
    return this.keep((await response.json()) as Tokens);
  }

  /** The new access token once both tokens are kept, or null when COO's answer lacks them. */
  private async keep(tokens: Tokens): Promise<string | null> {
    const { accessToken, refreshToken, accessTokenExpiresAt } = tokens;
    if (typeof accessToken !== 'string' || typeof refreshToken !== 'string') {
      return null;
    }
    const expiresAt =
      typeof accessTokenExpiresAt === 'string' ? Date.parse(accessTokenExpiresAt) : NaN;
    this.access = { token: accessToken, expiresAt: Number.isNaN(expiresAt) ? 0 : expiresAt };
    await this.ports.saveRefreshToken(refreshToken);
    return accessToken;
  }

  private async send(path: string, body: object, token?: string) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token !== undefined) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return this.ports.fetch(`${this.ports.serverUrl().replace(/\/+$/, '')}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  }
}
