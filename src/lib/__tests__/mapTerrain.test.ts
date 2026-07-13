import { describe, it, expect } from '@jest/globals';
import type { StyleSpecification } from '@maplibre/maplibre-gl-style-spec';
import { TERRAIN_EXAGGERATION, TERRAIN_SOURCE_ID, withTerrain } from '../mapTerrain';

function baseStyle(): StyleSpecification {
  return {
    version: 8,
    sources: { outdoor: { type: 'vector', url: 'https://example.com/tiles.json' } },
    layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#fff' } }],
  } as StyleSpecification;
}

describe('withTerrain', () => {
  it('adds a terrain block referencing TERRAIN_SOURCE_ID at the default exaggeration', () => {
    const result = withTerrain(baseStyle());
    expect(result.terrain).toEqual({ source: TERRAIN_SOURCE_ID, exaggeration: TERRAIN_EXAGGERATION });
  });

  it('honors a custom exaggeration', () => {
    const result = withTerrain(baseStyle(), 2);
    expect(result.terrain).toEqual({ source: TERRAIN_SOURCE_ID, exaggeration: 2 });
  });

  it('adds a sky block', () => {
    const result = withTerrain(baseStyle());
    expect(result.sky).toBeDefined();
  });

  it('never mutates the caller-supplied sources/layers', () => {
    const style = baseStyle();
    const result = withTerrain(style);
    expect(result.sources).toBe(style.sources);
    expect(result.layers).toBe(style.layers);
  });
});
