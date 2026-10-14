/**
 * Talking to the ComeOnOverUno server from the GM's browser. Added 2026-09-14.
 *
 * ⛔ NO SECRET LIVES IN THIS FILE. Foundry sends a module's code to every player. Decided with Lewis: the
 * GM signs in to COO once, and only the REFRESH token is kept, in a client setting that exists in that
 * one browser. Since 2026-10-14 the sign-in is a one-time PAIRING CODE from the COO app (Settings, Pair a
 * device), because COO accounts no longer have passwords. The COO endpoint requires the Admin role.
 *
 * ⚠️ COO ROTATES REFRESH TOKENS, so two refreshes at once would spend the same token twice and the second
 * would sign the GM out. Every refresh goes through one shared in-flight promise.
 */
export interface CooPorts {
  readonly fetch: (
    url: string,
    init: { method: string; headers: Record<string, string>; body?: string }
  ) => Promise<{ status: number; json: () => Promise<unknown> }>;
  readonly serverUrl: () => string;
  readonly refreshToken: () => string;
  readonly saveRefreshToken: (token: string) => Promise<void>;
  readonly now: () => number;
  /** The installed Tongs version, stamped on every signed-in post so a message shows what sent it. */
  readonly version?: () => string;
  /**
   * COO refused the kept sign-in, so nothing posts until the GM signs in again. Called once per loss.
   * ⚠️ Added 2026-10-13: on C06 a COO web logout ended this session and the wipe below was silent, so a
   * whole fight's hits never reached Telegram and nobody knew.
   */
  readonly lostSession?: () => void;
}

export interface BandPost {
  readonly name: string;
  readonly segments: number;
  readonly word: string;
  readonly hp: number;
  readonly maxHp: number;
  readonly announce: boolean;
  /**
   * The HP last told for this token, for the GM's DM only ("3 → 2/16 HP"). Absent for a token never seen
   * before. Added 2026-10-07: whether Kreski's 2/16 should have reached the topic hung on this number.
   */
  readonly previousHp?: number;
  /** For the GM's DM only; COO never puts it on the public line. */
  readonly cause: string;
  /** What hit it, for the topic; present only when players can see the attacker (`attackerView.ts`). */
  readonly publicCause?: string;
  readonly attackerImage?: string;
  /** Present only when players can see the creature's name (`bandSubject.ts`). */
  readonly targetImage?: string;
}

export type PostOutcome = 'sent' | 'signed-out' | 'failed';

export interface CooResponse {
  readonly status: number;
  json(): Promise<unknown>;
}

interface Tokens {
  readonly accessToken?: unknown;
  readonly refreshToken?: unknown;
  readonly accessTokenExpiresAt?: unknown;
}

/** A minute's margin, so a token about to expire is refreshed rather than sent and refused. */
const EARLY_MS = 60_000;

/** The refresh answers that mean COO no longer accepts the kept token. */
const REFUSED = new Set([400, 401, 403]);

/** What the COO app's list of signed-in devices calls this session, after "Paired: ". */
export const PAIRED_DEVICE_NAME = 'Tongs Browser';

export class CooClient {
  private readonly ports: CooPorts;
  private access: { token: string; expiresAt: number } | null = null;
  private refreshing: Promise<string | null> | null = null;

  public constructor(ports: CooPorts) {
    this.ports = ports;
  }

  /** True when COO accepted the pairing code and a refresh token was kept. */
  public async pair(code: string): Promise<boolean> {
    const response = await this.send('/api/auth/pair', { code, deviceName: PAIRED_DEVICE_NAME });
    return response.status === 200 && (await this.keep((await response.json()) as Tokens)) !== null;
  }

  public async postBand(campaign: string, post: BandPost): Promise<PostOutcome> {
    const response = await this.call(
      'POST',
      `/api/pathwars/campaigns/${encodeURIComponent(campaign)}/combat-band`,
      post
    );
    return response === 'signed-out' ? response : response.status === 200 ? 'sent' : 'failed';
  }

  /**
   * One call as the signed-in GM. ⚠️ A 401 refreshes ONCE and retries: an access token can expire between the
   * check and the call. `signed-out` when there is no session to refresh.
   */
  public async call(
    method: 'GET' | 'POST',
    path: string,
    body?: object
  ): Promise<CooResponse | 'signed-out'> {
    for (const attempt of [1, 2]) {
      const token = await this.accessToken(attempt === 2);
      if (token === null) {
        return 'signed-out';
      }
      /* ⚠️ Added 2026-09-16 at Lewis's request: COO shows the version in its messages, for debugging. */
      const stamped =
        body === undefined
          ? undefined
          : { ...body, tongsVersion: this.ports.version?.() ?? 'unknown' };
      const response = await this.send(path, stamped, token, method);
      if (response.status !== 401) {
        return response;
      }
    }
    return 'signed-out';
  }

  /** One call with no session, from any player's browser: only for endpoints that trust nothing sent. */
  public async tell(path: string, body: object): Promise<number> {
    return (await this.send(path, body)).status;
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
      /* ⚠️ Only a refusal ends the sign-in: a 502 while COO redeploys says nothing about the token. */
      if (REFUSED.has(response.status)) {
        await this.ports.saveRefreshToken('');
        this.ports.lostSession?.();
      }
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

  private async send(path: string, body: object | undefined, token?: string, method = 'POST') {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token !== undefined) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return this.ports.fetch(`${this.ports.serverUrl().replace(/\/+$/, '')}${path}`, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }
}
