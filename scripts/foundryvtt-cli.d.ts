/**
 * The one call scripts/build-packs.ts makes. @foundryvtt/foundryvtt-cli 3.0.5 ships no types.
 */
declare module '@foundryvtt/foundryvtt-cli' {
  export function compilePack(
    src: string,
    dest: string,
    options?: { nedb?: boolean; yaml?: boolean; log?: boolean; recursive?: boolean }
  ): Promise<void>;
}
