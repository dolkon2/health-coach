/**
 * conditions/synoptic.ts — pure parser over the Synoptic/MesoWest API v2
 * `/stations/latest` response (forecast-tab.md §3, F2's broader-coverage
 * source: ODOT/WSDOT road stations and other networks NWS doesn't carry,
 * for the "closest live reading" gap the research doc flagged in the Gorge).
 *
 * Requested with `units=speed|kts,temp|C` (synopticClient.ts) so the values
 * already arrive in this app's native units — but the response's own `UNITS`
 * block is still asserted before any wind/temp field is read (same
 * assert-before-read rule as forecast.ts's windOk and nws.ts's unitCode
 * check), never trusted blind because a query param was set correctly.
 *
 * ⚑ Shape best-effort against Synoptic's public v2 docs — this pass has no
 * live token to verify the exact response against (F2 build session had
 * none configured); every field read is defensive (wrong type → dropped,
 * never a throw), so a real-world shape mismatch degrades to "no reading"
 * rather than a crash. Re-verify field names once a token exists.
 */

function finite(v: unknown): number | undefined {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    return Number.isNaN(n) ? undefined : n;
  }
  return undefined;
}

function unitIs(units: unknown, key: string, expected: string): boolean {
  if (!units || typeof units !== 'object') return false;
  const v = (units as Record<string, unknown>)[key];
  return typeof v === 'string' && v.toLowerCase() === expected;
}

interface ObsValue {
  value?: unknown;
  date_time?: unknown;
}

function obsAt(observations: unknown, key: string): ObsValue | undefined {
  if (!observations || typeof observations !== 'object') return undefined;
  const v = (observations as Record<string, unknown>)[key];
  return v && typeof v === 'object' ? (v as ObsValue) : undefined;
}

export interface SynopticStation {
  stationId: string;
  name: string;
  lat: number;
  lng: number;
  observedAtUtc: string;
  windAvgKts?: number;
  windGustKts?: number;
  windDirectionDeg?: number;
  tempC?: number;
}

/**
 * Parse a `/stations/latest` body into stations carrying a usable reading.
 * A station missing an id, coordinates, or ANY timestamped observation is
 * dropped outright (nothing to freeze an age against); wind/temp fields are
 * independently honest-miss on a bad UNITS match or a non-numeric value.
 */
export function parseSynopticLatest(json: unknown): SynopticStation[] {
  if (!json || typeof json !== 'object') return [];
  const body = json as Record<string, unknown>;
  const list = body.STATION;
  if (!Array.isArray(list)) return [];

  const windOk = unitIs(body.UNITS, 'wind_speed', 'knots');
  const tempOk = unitIs(body.UNITS, 'air_temp', 'celsius');

  const out: SynopticStation[] = [];
  for (const s of list) {
    if (!s || typeof s !== 'object') continue;
    const station = s as Record<string, unknown>;
    const stationId = station.STID;
    if (typeof stationId !== 'string' || stationId.length === 0) continue;

    const lat = finite(station.LATITUDE);
    const lng = finite(station.LONGITUDE);
    if (lat === undefined || lng === undefined) continue;

    const obs = station.OBSERVATIONS;
    const tempObs = obsAt(obs, 'air_temp_value_1');
    const windObs = obsAt(obs, 'wind_speed_value_1');
    const gustObs = obsAt(obs, 'wind_gust_value_1');
    const dirObs = obsAt(obs, 'wind_direction_value_1');

    // The freshest of whichever fields the station reported — this is the
    // reading's observation moment, staleness is judged against it
    // upstream. Compared by PARSED time, not string sort: a lexicographic
    // sort silently mis-orders two ISO timestamps of differing precision
    // (e.g. a whole-second 'Z' reading vs a fractional-second one) even
    // though both are valid RFC3339 — real dates never lie about order.
    const observedAtUtc = [tempObs, windObs, gustObs, dirObs]
      .map((o) => (typeof o?.date_time === 'string' ? o.date_time : undefined))
      .filter((t): t is string => t !== undefined)
      .reduce<string | undefined>((latest, t) => {
        if (latest === undefined) return t;
        return Date.parse(t) > Date.parse(latest) ? t : latest;
      }, undefined);
    if (!observedAtUtc) continue;

    const windAvgKts = windOk ? finite(windObs?.value) : undefined;
    const windGustKts = windOk ? finite(gustObs?.value) : undefined;
    const windDirectionDeg = finite(dirObs?.value);
    const tempC = tempOk ? finite(tempObs?.value) : undefined;

    const name = typeof station.NAME === 'string' ? station.NAME : stationId;

    out.push({
      stationId,
      name,
      lat,
      lng,
      observedAtUtc,
      ...(windAvgKts !== undefined ? { windAvgKts } : {}),
      ...(windGustKts !== undefined ? { windGustKts } : {}),
      ...(windDirectionDeg !== undefined ? { windDirectionDeg } : {}),
      ...(tempC !== undefined ? { tempC } : {}),
    });
  }
  return out;
}
