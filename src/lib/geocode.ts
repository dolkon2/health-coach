/**
 * geocode.ts — location search, base chrome on both Map tab modes (map-tab.md
 * REFRAME AMENDMENT). MapTiler geocoding on the existing key; Nominatim
 * (OpenStreetMap, free, no key) when unset — the same "degrade honestly,
 * never block the feature" rule every other MapTiler/conditions endpoint in
 * this app follows (config.ts). Any failure, or an empty query, resolves to
 * `[]` — a bad or empty search is a normal outcome, not a fault, so this
 * never throws.
 *
 * The two response parsers are pure functions, kept separate from the fetch
 * calls so they're unit-testable without an env-dependent MAPTILER_KEY or a
 * mocked network layer (same "extract the pure parser" precedent as F2's
 * parseSynopticLatest).
 *
 * Nominatim's usage policy requires a `User-Agent` identifying the app and
 * caps at ~1 req/sec with no autocomplete-on-keystroke — the caller (map.tsx)
 * fires this on submit, never on every keystroke.
 */
import { fetchJson, type FetchJsonDeps } from './conditions/fetchJson';
import { MAPTILER_KEY, mapGeocodeUrl } from './config';

export type GeocodeResult = { label: string; lat: number; lng: number };
export type GeocodeDeps = FetchJsonDeps;

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const NOMINATIM_USER_AGENT = 'health-coach/1.0 (personal training tracker)';

type MapTilerFeature = {
  place_name?: string;
  text?: string;
  center?: [number, number]; // [lng, lat]
};
type MapTilerResponse = { features?: MapTilerFeature[] };

/** MapTiler's Mapbox-compatible GeoJSON FeatureCollection → normalized results. */
export function parseMapTilerResponse(json: unknown, fallbackLabel: string): GeocodeResult[] {
  const res = json as MapTilerResponse | null;
  if (!res?.features) return [];
  const out: GeocodeResult[] = [];
  for (const f of res.features) {
    if (!f.center) continue;
    out.push({ label: f.place_name ?? f.text ?? fallbackLabel, lat: f.center[1], lng: f.center[0] });
  }
  return out;
}

type NominatimRow = { display_name?: string; lat?: string; lon?: string };

/** Nominatim's row array → normalized results; a malformed row is skipped, not thrown. */
export function parseNominatimResponse(json: unknown): GeocodeResult[] {
  const rows = json as NominatimRow[] | null;
  if (!rows) return [];
  const out: GeocodeResult[] = [];
  for (const row of rows) {
    const lat = row.lat != null ? Number(row.lat) : NaN;
    const lng = row.lon != null ? Number(row.lon) : NaN;
    if (!row.display_name || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    out.push({ label: row.display_name, lat, lng });
  }
  return out;
}

async function geocodeMapTiler(query: string, deps?: GeocodeDeps): Promise<GeocodeResult[]> {
  const url = mapGeocodeUrl(query);
  if (!url) return [];
  const json = await fetchJson(url, deps);
  return parseMapTilerResponse(json, query);
}

async function geocodeNominatim(query: string, deps?: GeocodeDeps): Promise<GeocodeResult[]> {
  const url = `${NOMINATIM_URL}?q=${encodeURIComponent(query)}&format=json&limit=5`;
  const json = await fetchJson(url, {
    ...deps,
    headers: { ...deps?.headers, 'User-Agent': NOMINATIM_USER_AGENT },
  });
  return parseNominatimResponse(json);
}

/** MapTiler when a key is configured, else the free Nominatim fallback. */
export async function geocode(query: string, deps?: GeocodeDeps): Promise<GeocodeResult[]> {
  const q = query.trim();
  if (!q) return [];
  return MAPTILER_KEY ? geocodeMapTiler(q, deps) : geocodeNominatim(q, deps);
}
