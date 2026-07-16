import { describe, it, expect, jest } from '@jest/globals';
import {
  routingModeForActivity,
  decodePolyline,
  decodeValhalla,
  parseOverpassWays,
  clipWaterway,
  overpassBBox,
  buildOverpassQuery,
  snapSegment,
} from '../routeSnap';
import type { LatLng } from '@core/geo';

/** Standard encoded-polyline encoder — test scaffolding to round-trip against
 *  decodePolyline and to build mock Valhalla shapes (precision 6). */
function encodePolyline(coords: LatLng[], precision = 6): string {
  const factor = Math.pow(10, precision);
  const enc = (v: number): string => {
    let sgn = v < 0 ? ~(v << 1) : v << 1;
    let s = '';
    while (sgn >= 0x20) {
      s += String.fromCharCode((0x20 | (sgn & 0x1f)) + 63);
      sgn >>= 5;
    }
    s += String.fromCharCode(sgn + 63);
    return s;
  };
  let lastLat = 0;
  let lastLng = 0;
  let out = '';
  for (const c of coords) {
    const lat = Math.round(c.lat * factor);
    const lng = Math.round(c.lng * factor);
    out += enc(lat - lastLat) + enc(lng - lastLng);
    lastLat = lat;
    lastLng = lng;
  }
  return out;
}

function mockFetch(data: unknown, ok = true) {
  return jest.fn(async () => ({ ok, json: async () => data })) as unknown as typeof fetch;
}

describe('routingModeForActivity', () => {
  it('maps run/hike to foot, ride to bike, paddle to river', () => {
    expect(routingModeForActivity('run')).toBe('foot');
    expect(routingModeForActivity('trail-run')).toBe('foot');
    expect(routingModeForActivity('hike')).toBe('foot');
    expect(routingModeForActivity('walk')).toBe('foot');
    expect(routingModeForActivity('ride')).toBe('bike');
    expect(routingModeForActivity('mtb')).toBe('bike');
    expect(routingModeForActivity('kayak')).toBe('river');
    expect(routingModeForActivity('whitewater')).toBe('river');
  });

  it('is free-line for paragliding, open-water, snow, body, and unknown ids', () => {
    expect(routingModeForActivity('paragliding')).toBe('freeline');
    expect(routingModeForActivity('surf')).toBe('freeline');
    expect(routingModeForActivity('swim')).toBe('freeline');
    expect(routingModeForActivity('ski')).toBe('freeline');
    expect(routingModeForActivity('climb')).toBe('freeline');
    expect(routingModeForActivity('gym')).toBe('freeline');
    expect(routingModeForActivity('not-an-activity')).toBe('freeline');
  });
});

describe('decodePolyline', () => {
  it('decodes the canonical Google precision-5 vector', () => {
    const out = decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@', 5);
    expect(out).toHaveLength(3);
    expect(out[0].lat).toBeCloseTo(38.5, 5);
    expect(out[0].lng).toBeCloseTo(-120.2, 5);
    expect(out[1].lat).toBeCloseTo(40.7, 5);
    expect(out[1].lng).toBeCloseTo(-120.95, 5);
    expect(out[2].lat).toBeCloseTo(43.252, 5);
    expect(out[2].lng).toBeCloseTo(-126.453, 5);
  });

  it('round-trips precision-6 coordinates through the test encoder', () => {
    const coords: LatLng[] = [
      { lat: 45.7054, lng: -121.5215 },
      { lat: 45.71, lng: -121.53 },
      { lat: 45.715, lng: -121.54 },
    ];
    const decoded = decodePolyline(encodePolyline(coords, 6), 6);
    decoded.forEach((p, i) => {
      expect(p.lat).toBeCloseTo(coords[i].lat, 5);
      expect(p.lng).toBeCloseTo(coords[i].lng, 5);
    });
  });
});

describe('decodeValhalla', () => {
  it('concatenates leg shapes, dropping the duplicate join vertex', () => {
    const legA: LatLng[] = [
      { lat: 45.0, lng: -121.0 },
      { lat: 45.1, lng: -121.1 },
    ];
    const legB: LatLng[] = [
      { lat: 45.1, lng: -121.1 }, // shared join
      { lat: 45.2, lng: -121.2 },
    ];
    const json = { trip: { legs: [{ shape: encodePolyline(legA) }, { shape: encodePolyline(legB) }] } };
    const out = decodeValhalla(json);
    expect(out).not.toBeNull();
    expect(out).toHaveLength(3); // 2 + 2 - 1 shared join
  });

  it('returns null for a shapeless response', () => {
    expect(decodeValhalla(null)).toBeNull();
    expect(decodeValhalla({})).toBeNull();
    expect(decodeValhalla({ trip: { legs: [{}] } })).toBeNull();
  });
});

describe('parseOverpassWays', () => {
  it('extracts way geometries as LatLng, skipping non-ways and short lines', () => {
    const json = {
      elements: [
        { type: 'way', geometry: [{ lat: 1, lon: 2 }, { lat: 1.1, lon: 2.1 }] },
        { type: 'node', lat: 5, lon: 6 },
        { type: 'way', geometry: [{ lat: 9, lon: 9 }] }, // too short
      ],
    };
    const ways = parseOverpassWays(json);
    expect(ways).toHaveLength(1);
    expect(ways[0]).toEqual([{ lat: 1, lng: 2 }, { lat: 1.1, lng: 2.1 }]);
  });

  it('returns [] for a shapeless response', () => {
    expect(parseOverpassWays(null)).toEqual([]);
    expect(parseOverpassWays({})).toEqual([]);
  });
});

describe('clipWaterway', () => {
  // A short synthetic north-running river of 5 vertices ~ 111 m apart.
  const river: LatLng[] = [
    { lat: 45.0, lng: -121.0 },
    { lat: 45.001, lng: -121.0 },
    { lat: 45.002, lng: -121.0 },
    { lat: 45.003, lng: -121.0 },
    { lat: 45.004, lng: -121.0 },
  ];

  it('returns the sub-polyline between the two nearest vertices, oriented a→b', () => {
    const a = { lat: 45.0009, lng: -121.00001 }; // near vertex 1
    const b = { lat: 45.0031, lng: -121.00001 }; // near vertex 3
    const clip = clipWaterway([river], a, b);
    expect(clip).toEqual([
      { lat: 45.001, lng: -121.0 },
      { lat: 45.002, lng: -121.0 },
      { lat: 45.003, lng: -121.0 },
    ]);
  });

  it('orients the clip a→b even when b is upstream of a', () => {
    const a = { lat: 45.0031, lng: -121.00001 }; // near vertex 3
    const b = { lat: 45.0009, lng: -121.00001 }; // near vertex 1
    const clip = clipWaterway([river], a, b);
    expect(clip?.[0]).toEqual({ lat: 45.003, lng: -121.0 });
    expect(clip?.[clip.length - 1]).toEqual({ lat: 45.001, lng: -121.0 });
  });

  it('returns null when the points are farther than maxSnapM from any river', () => {
    const a = { lat: 46.0, lng: -122.0 };
    const b = { lat: 46.01, lng: -122.0 };
    expect(clipWaterway([river], a, b)).toBeNull();
  });

  it('returns null for no ways', () => {
    expect(clipWaterway([], river[0], river[4])).toBeNull();
  });
});

describe('overpassBBox / buildOverpassQuery', () => {
  it('pads the a→b bounding box', () => {
    const [s, w, n, e] = overpassBBox({ lat: 45, lng: -121 }, { lat: 46, lng: -120 }, 0.01);
    expect(s).toBeCloseTo(44.99);
    expect(w).toBeCloseTo(-121.01);
    expect(n).toBeCloseTo(46.01);
    expect(e).toBeCloseTo(-119.99);
  });

  it('builds a waterway query over that bbox', () => {
    const q = buildOverpassQuery({ lat: 45, lng: -121 }, { lat: 46, lng: -120 });
    expect(q).toContain('way["waterway"]');
    expect(q).toContain('out geom;');
  });
});

describe('snapSegment', () => {
  const a = { lat: 45.0, lng: -121.0 };
  const b = { lat: 45.01, lng: -121.01 };

  it('freeline returns the straight segment, not flagged a fallback', async () => {
    const res = await snapSegment(a, b, 'freeline');
    expect(res).toEqual({ coords: [a, b], fellBack: false });
  });

  it('foot with no engine configured falls back to free-line, flagged', async () => {
    const res = await snapSegment(a, b, 'foot', { valhallaUrl: null });
    expect(res).toEqual({ coords: [a, b], fellBack: true });
  });

  it('foot decodes a Valhalla response over a mocked fetch', async () => {
    const shape: LatLng[] = [a, { lat: 45.005, lng: -121.005 }, b];
    const fetchImpl = mockFetch({ trip: { legs: [{ shape: encodePolyline(shape) }] } });
    const res = await snapSegment(a, b, 'foot', { valhallaUrl: 'https://engine.test/route', fetchImpl });
    expect(res.fellBack).toBe(false);
    expect(res.coords).toHaveLength(3);
    expect(res.coords[1].lat).toBeCloseTo(45.005, 5);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('foot falls back when the engine returns a non-ok response', async () => {
    const fetchImpl = mockFetch({}, false);
    const res = await snapSegment(a, b, 'foot', { valhallaUrl: 'https://engine.test/route', fetchImpl });
    expect(res).toEqual({ coords: [a, b], fellBack: true });
  });

  it('river clips the OSM waterway over a mocked Overpass fetch', async () => {
    const river = [
      { lat: 45.0, lng: -121.0 },
      { lat: 45.005, lng: -121.005 },
      { lat: 45.01, lng: -121.01 },
    ];
    const fetchImpl = mockFetch({
      elements: [{ type: 'way', geometry: river.map((p) => ({ lat: p.lat, lon: p.lng })) }],
    });
    const res = await snapSegment(a, b, 'river', { overpassUrl: 'https://overpass.test', fetchImpl });
    expect(res.fellBack).toBe(false);
    expect(res.coords).toHaveLength(3);
  });

  it('river falls back to free-line when no waterway is nearby', async () => {
    const fetchImpl = mockFetch({ elements: [] });
    const res = await snapSegment(a, b, 'river', { overpassUrl: 'https://overpass.test', fetchImpl });
    expect(res).toEqual({ coords: [a, b], fellBack: true });
  });

  it('never throws when the network rejects', async () => {
    const fetchImpl = jest.fn(async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch;
    const res = await snapSegment(a, b, 'foot', { valhallaUrl: 'https://engine.test/route', fetchImpl });
    expect(res).toEqual({ coords: [a, b], fellBack: true });
  });
});
