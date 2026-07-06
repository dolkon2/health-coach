/**
 * freeze.ts — the one call site the save path uses: freeze Earth conditions
 * onto a session, best-effort (⚑ E-2).
 *
 * Contract: NEVER throws, NEVER hangs a save. Each requested sub-fetch runs
 * independently — one failing (or hanging: every sub-fetch races a deadline)
 * costs only its own sub-object, and all-fail returns {} which callers treat
 * as absence (an empty snapshot is never stored). Offline → {} after the
 * deadline; there is no retry queue this pass — a session saved before the
 * fetch resolves simply has no conditions, forever honest about it.
 *
 * Conditions are pull-only context: this module fetches when the USER logs a
 * session, and nothing here (or downstream) turns a reading into advice.
 */
import type { ConditionsSnapshot } from '@core/conditions';
import { fetchWeatherAt } from './openMeteo';
import { fetchSnotelConditions } from './snotel';
import { fetchAvalancheAt } from './avalancheOrg';

export interface FreezeEarthInput {
  lat: number;
  lng: number;
  /** The session's start instant — picks the weather hour. */
  atIso: string;
  /** The session's civil day — required for the SNOTEL daily read; snow is
   *  skipped (not guessed from a UTC slice) when it's absent. */
  dateLocal?: string;
  /** Which sub-objects to attempt. E3 wires weather only; snow/avalanche
   *  join with the ski surface (E7). */
  include: { weather?: boolean; snow?: boolean; avalanche?: boolean };
}

export interface FreezeEarthDeps {
  fetchImpl?: typeof fetch;
  /** Per-sub-fetch deadline. Short by design: a save must never wait on
   *  weather (⚑ E-2). */
  timeoutMs?: number;
  now?: () => Date;
}

/**
 * Race a sub-fetch against the deadline: whatever hasn't produced a value by
 * then is null. Errors are folded to null BEFORE the race so a slow loser
 * rejecting later can't surface as an unhandled rejection.
 */
function withDeadline<T>(p: Promise<T | null>, timeoutMs: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), timeoutMs);
  });
  return Promise.race([p.catch(() => null), deadline]).finally(() => clearTimeout(timer));
}

/**
 * Freeze the requested Earth conditions for a point + instant. Resolves to a
 * ConditionsSnapshot holding only the sub-objects that actually landed — {}
 * when nothing did. Live callers pass no deps (global fetch, 4 s deadline);
 * tests inject fetchImpl/now.
 */
export async function freezeEarthConditions(
  input: FreezeEarthInput,
  deps: FreezeEarthDeps = {}
): Promise<ConditionsSnapshot> {
  const timeoutMs = deps.timeoutMs ?? 4000;
  const sub = { fetchImpl: deps.fetchImpl, now: deps.now };
  const { lat, lng } = input;

  const [weather, snow, avalanche] = await Promise.all([
    input.include.weather
      ? withDeadline(fetchWeatherAt({ lat, lng, atIso: input.atIso }, sub), timeoutMs)
      : Promise.resolve(null),
    input.include.snow && input.dateLocal
      ? withDeadline(
          fetchSnotelConditions({ lat, lng, dateLocal: input.dateLocal }, sub),
          timeoutMs
        )
      : Promise.resolve(null),
    input.include.avalanche
      ? withDeadline(fetchAvalancheAt({ lat, lng }, sub), timeoutMs)
      : Promise.resolve(null),
  ]);

  return {
    ...(weather ? { weather } : {}),
    ...(snow ? { snow } : {}),
    ...(avalanche ? { avalanche } : {}),
  };
}
