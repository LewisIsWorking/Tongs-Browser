/**
 * The logic of `check:routes`, apart from the network so it can be tested.
 *
 * ⚠️ THE FAILURE THIS EXISTS FOR: Tongs posted every HP change to a COO `hp-change` route that had
 * never shipped. A browser refuses such a call at the preflight, so the post failed the same way on
 * every attempt, and three weeks of history were lost before the heartbeat showed it.
 */

/** Stands in for every `${...}` in a path: routes that constrain an id to a GUID still match it. */
const STAND_IN = '3f2504e0-4f89-11d3-9a0c-0305e82c3301';

/** Answers whether COO's preflight lets the browser make this call. */
export type Preflight = (path: string, method: 'GET' | 'POST') => Promise<boolean>;

/** Every distinct COO path quoted in a source file, with its template holes filled in. */
export function cooPathsIn(source: string): string[] {
  const quoted = source.matchAll(/[`'"](\/api\/[^`'"\s]+)[`'"]/g);
  return [
    ...new Set([...quoted].map((match) => match[1]?.replace(/\$\{[^}]*\}/g, STAND_IN) ?? '')),
  ];
}

/**
 * The paths COO accepts for neither verb. Either verb passing is enough, because a path in the source
 * does not say which one it is called with, and a route that does not exist answers for neither.
 */
export async function missingRoutes(paths: string[], allows: Preflight): Promise<string[]> {
  const missing: string[] = [];
  for (const path of paths) {
    if (!(await allows(path, 'POST')) && !(await allows(path, 'GET'))) {
      missing.push(path);
    }
  }
  return missing;
}
