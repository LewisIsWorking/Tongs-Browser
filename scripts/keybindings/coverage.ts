import { CORE_BINDINGS, type FoundryBinding } from './snapshot.ts';
import { ROUTES, type Route } from './routes.ts';

export { ROUTES, type Route };

/**
 * Checking the routing table against what Foundry registers. Added 2026-09-07.
 *
 * ⚠️ THE TABLE ITSELF MOVED to `routes.ts` on 2026-09-10, when routing the four bindings 14.367
 * added took this file past the 200 line limit. This half is the machinery; that half is the
 * decisions. Extract rather than trim, and the seam was already there to be found.
 *
 * ⚠️ `ROUTES` and `Route` are re-exported so existing callers keep working, which is a courtesy to
 * readers rather than an invitation: new code should import them from `routes.ts`, where they live.
 */

export interface CoverageProblem {
  readonly binding: string;
  readonly reason: string;
}

/**
 * Every binding must have a route, and every route must still point at something that exists.
 *
 * ⚠️ The second half is the part with teeth. A table saying "target is reached by the bar key KeyT"
 * is worth nothing if nobody notices when KeyT is removed, and that is exactly how a coverage
 * document rots into a lie while reading as authoritative.
 */
export function findProblems(
  barCodes: ReadonlySet<string>,
  trayIds: ReadonlySet<string>,
  bindings: readonly FoundryBinding[] = CORE_BINDINGS,
  routes: Readonly<Record<string, Route>> = ROUTES
): CoverageProblem[] {
  const problems: CoverageProblem[] = [];

  for (const binding of bindings) {
    const route = routes[binding.name];
    if (route === undefined) {
      /*
       * ⚠️ An UNBOUND binding needs different words, added 2026-09-10 with the 14.367 snapshot.
       * Foundry 14.367 registers four diagonal moves with no `editable` array at all, and the old
       * message rendered that as "Foundry binds it to ;", which reads like a bug in the guard rather
       * than a fact about the binding. It also matters for the decision being asked for: a binding
       * nobody can press on a KEYBOARD either is not the same gap as one a phone cannot reach.
       */
      problems.push({
        binding: binding.name,
        reason:
          binding.keys.length === 0
            ? 'is not accounted for. Foundry registers it with NO default key, so it is unbound on every device; say whether that is a gap worth closing'
            : `is not accounted for. Foundry binds it to ${binding.keys.join(' or ')}; say whether a phone can reach it`,
      });
      continue;
    }
    if (route.kind === 'bar' && !barCodes.has(route.via)) {
      problems.push({
        binding: binding.name,
        reason: `claims the bar key ${route.via}, which the bar no longer offers`,
      });
    }
    if (route.kind === 'tray' && !trayIds.has(route.via)) {
      problems.push({
        binding: binding.name,
        reason: `claims the tray button ${route.via}, which the control pad no longer offers`,
      });
    }
  }

  for (const name of Object.keys(routes)) {
    if (!bindings.some((binding) => binding.name === name)) {
      problems.push({ binding: name, reason: 'is routed here but Foundry no longer registers it' });
    }
  }

  return problems;
}

export function countByKind(
  routes: Readonly<Record<string, Route>> = ROUTES
): Record<string, number> {
  const counts: Record<string, number> = { bar: 0, tray: 0, ui: 0, gap: 0 };
  for (const route of Object.values(routes)) {
    counts[route.kind] = (counts[route.kind] ?? 0) + 1;
  }
  return counts;
}
