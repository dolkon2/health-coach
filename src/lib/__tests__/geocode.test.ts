import { describe, it, expect, jest } from '@jest/globals';
import { geocode, parseMapTilerResponse, parseNominatimResponse } from '../geocode';

describe('parseMapTilerResponse', () => {
  it('normalizes features with a center into label/lat/lng', () => {
    const out = parseMapTilerResponse(
      {
        features: [
          { place_name: 'Hood River, OR', center: [-121.5215, 45.7054] },
          { text: 'The Dalles', center: [-121.1787, 45.5946] },
        ],
      },
      'fallback'
    );
    expect(out).toEqual([
      { label: 'Hood River, OR', lat: 45.7054, lng: -121.5215 },
      { label: 'The Dalles', lat: 45.5946, lng: -121.1787 },
    ]);
  });

  it('falls back to the query string when a feature has no name', () => {
    const out = parseMapTilerResponse({ features: [{ center: [1, 2] }] }, 'my query');
    expect(out).toEqual([{ label: 'my query', lat: 2, lng: 1 }]);
  });

  it('skips a feature with no center', () => {
    const out = parseMapTilerResponse({ features: [{ place_name: 'Nowhere' }] }, 'q');
    expect(out).toEqual([]);
  });

  it('returns [] for a null or shapeless response', () => {
    expect(parseMapTilerResponse(null, 'q')).toEqual([]);
    expect(parseMapTilerResponse({}, 'q')).toEqual([]);
  });
});

describe('parseNominatimResponse', () => {
  it('normalizes rows, parsing lat/lon strings to numbers', () => {
    const out = parseNominatimResponse([
      { display_name: 'Hood River, OR, USA', lat: '45.7054', lon: '-121.5215' },
    ]);
    expect(out).toEqual([{ label: 'Hood River, OR, USA', lat: 45.7054, lng: -121.5215 }]);
  });

  it('skips a row missing a name or an unparsable coordinate', () => {
    const out = parseNominatimResponse([
      { lat: '45.7', lon: '-121.5' }, // no display_name
      { display_name: 'Bad coords', lat: 'not-a-number', lon: '-121.5' },
      { display_name: 'Good', lat: '45.7', lon: '-121.5' },
    ]);
    expect(out).toEqual([{ label: 'Good', lat: 45.7, lng: -121.5 }]);
  });

  it('returns [] for a null response', () => {
    expect(parseNominatimResponse(null)).toEqual([]);
  });
});

describe('geocode', () => {
  it('returns [] for an empty or whitespace-only query without fetching', async () => {
    const fetchImpl = jest.fn();
    expect(await geocode('', { fetchImpl: fetchImpl as unknown as typeof fetch })).toEqual([]);
    expect(await geocode('   ', { fetchImpl: fetchImpl as unknown as typeof fetch })).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
