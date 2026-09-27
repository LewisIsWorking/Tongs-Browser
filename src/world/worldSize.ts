/**
 * Whether a world has grown big enough to tell its GM about. Added 2026-09-23.
 *
 * ⛔ ASKED FOR BY LEWIS: "Could Tongs also check the world size on launch and warn if the world size exceeds
 * 100MB". The Forge gives 1 GB in total and a world that eats it quietly is how a table finds out too late.
 *
 * ⛔ A BROWSER CANNOT MEASURE A WORLD. Foundry serves no size for one, and walking its file browser would be
 * hundreds of requests at launch. ComeOnOverUno measures it instead, from the volume Foundry runs on, so this
 * only ever knows what the server tells it; no size at all means no warning.
 *
 * Pure: the numbers are handed in, so what counts as too big is decided without a Foundry or a server.
 */
export interface WorldSize {
  readonly world: string;
  readonly bytes: number;
  readonly files: number;
  /** What the world's own databases hold: actors, scenes and above all the chat log. */
  readonly databaseBytes: number;
  /** Everything uploaded beside them: maps, tokens, audio. */
  readonly assetBytes: number;
}

const MB = 1024 * 1024;

/** One decimal place, and never "0.0 MB" for something that is there. */
function megabytes(bytes: number): string {
  const mb = bytes / MB;
  return `${mb >= 0.1 || bytes === 0 ? mb.toFixed(1) : '<0.1'} MB`;
}

/** The server's answer read into a size, or null: a shape nobody can trust is no measurement at all. */
export function readWorldSize(body: unknown): WorldSize | null {
  /* ⚠️ `null` is in the type because the server sends `{ size: null }` when it cannot measure. */
  const size = (body as { size?: Record<string, unknown> | null } | null | undefined)?.size;
  const number = (key: string) => {
    const value = size?.[key];
    return typeof value === 'number' ? value : null;
  };
  const bytes = number('bytes');
  if (size === undefined || size === null || bytes === null || typeof size['world'] !== 'string') {
    return null;
  }
  return {
    world: size['world'],
    bytes,
    files: number('files') ?? 0,
    databaseBytes: number('databaseBytes') ?? 0,
    assetBytes: number('assetBytes') ?? 0,
  };
}

/**
 * What to tell the GM, or null when the world is within its limit.
 *
 * ⚠️ It names the bigger half, because what to do about it differs: a database that big is usually the chat
 * log, which the GM can clear, while assets are maps and tokens they would have to delete.
 */
export function sizeWarning(size: WorldSize | null, limitMb: number): string | null {
  if (size === null || limitMb <= 0 || size.bytes <= limitMb * MB) {
    return null;
  }
  const biggest =
    size.databaseBytes >= size.assetBytes
      ? `Most of it is the world's own data (${megabytes(size.databaseBytes)}), which is usually the chat log.`
      : `Most of it is uploaded files (${megabytes(size.assetBytes)}): maps, tokens and audio.`;
  return (
    `${size.world} is ${megabytes(size.bytes)} across ${String(size.files)} files, over the ` +
    `${String(limitMb)} MB you asked to be warned about. ${biggest}`
  );
}
