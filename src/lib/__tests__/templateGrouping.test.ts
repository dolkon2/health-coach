import { describe, it, expect } from '@jest/globals';
import type { SessionTemplate, PracticeTemplateShape } from '@core/sessionTemplate';
import { groupTemplatesForLibrary } from '../templateGrouping';

function template(
  id: string,
  overrides: Partial<Pick<SessionTemplate, 'dayAssignment' | 'isActive'>>
): SessionTemplate {
  const shape: PracticeTemplateShape = { surface: 'practice' };
  return {
    id,
    name: id,
    surface: 'practice',
    activity: 'yoga',
    shape,
    isActive: true,
    createdAt: '2026-06-28T10:00:00Z',
    updatedAt: '2026-06-28T10:00:00Z',
    ...overrides,
  };
}

describe('groupTemplatesForLibrary', () => {
  it('puts templates with no day assignment in one-offs, regardless of isActive', () => {
    const oneOff = template('t1', { dayAssignment: undefined, isActive: true });
    const oneOffInactive = template('t2', { dayAssignment: undefined, isActive: false });
    const grouped = groupTemplatesForLibrary([oneOff, oneOffInactive]);
    expect(grouped.oneOffs.map((t) => t.id)).toEqual(['t1', 't2']);
    expect(grouped.active).toEqual([]);
    expect(grouped.deactivated).toEqual([]);
  });

  it('splits day-assigned templates into active vs deactivated by isActive', () => {
    const active = template('t1', { dayAssignment: 1, isActive: true });
    const paused = template('t2', { dayAssignment: 3, isActive: false });
    const grouped = groupTemplatesForLibrary([active, paused]);
    expect(grouped.active.map((t) => t.id)).toEqual(['t1']);
    expect(grouped.deactivated.map((t) => t.id)).toEqual(['t2']);
    expect(grouped.oneOffs).toEqual([]);
  });

  it('preserves input order within each group', () => {
    const templates = [
      template('one-a', {}),
      template('active-a', { dayAssignment: 0, isActive: true }),
      template('one-b', {}),
      template('deact-a', { dayAssignment: 2, isActive: false }),
      template('active-b', { dayAssignment: 5, isActive: true }),
    ];
    const grouped = groupTemplatesForLibrary(templates);
    expect(grouped.oneOffs.map((t) => t.id)).toEqual(['one-a', 'one-b']);
    expect(grouped.active.map((t) => t.id)).toEqual(['active-a', 'active-b']);
    expect(grouped.deactivated.map((t) => t.id)).toEqual(['deact-a']);
  });

  it('returns empty arrays for an empty input', () => {
    expect(groupTemplatesForLibrary([])).toEqual({ oneOffs: [], active: [], deactivated: [] });
  });
});
