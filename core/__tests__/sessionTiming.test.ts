/**
 * deriveSessionDuration — duration falls out of the set-timestamp spread, and is
 * honestly unknown (null, never 0) when the stamps are clustered or too few.
 */
import { describe, it, expect } from '@jest/globals';
import { deriveSessionDuration, CLUSTER_THRESHOLD_MIN } from '../src/sessionTiming';

describe('deriveSessionDuration', () => {
  it('derives whole minutes from the first→last completedAt spread (lived session)', () => {
    const d = deriveSessionDuration([
      { completedAt: '2026-06-26T17:00:00Z' },
      { completedAt: '2026-06-26T17:20:00Z' },
      { completedAt: '2026-06-26T17:52:30Z' },
    ]);
    expect(d.durationMin).toBe(53); // 52.5 min rounds up
    expect(d.fidelity).toBe(0.95); // a real lived spread
  });

  it('reports unknown duration + low fidelity for clustered (batch-entered) stamps', () => {
    const d = deriveSessionDuration([
      { completedAt: '2026-06-26T17:00:00Z' },
      { completedAt: '2026-06-26T17:00:20Z' },
      { completedAt: '2026-06-26T17:00:40Z' },
    ]);
    expect(d.durationMin).toBeNull(); // 40s spread < 2 min — unknown, never 0
    expect(d.fidelity).toBeLessThan(0.95);
  });

  it('reports unknown duration when fewer than two sets carry a stamp', () => {
    expect(deriveSessionDuration([{ completedAt: '2026-06-26T17:00:00Z' }]).durationMin).toBeNull();
    expect(deriveSessionDuration([{}, {}]).durationMin).toBeNull();
    expect(deriveSessionDuration([]).durationMin).toBeNull();
  });

  it('ignores unstamped sets and orders stamps regardless of input order', () => {
    const d = deriveSessionDuration([
      { completedAt: '2026-06-26T17:40:00Z' },
      {}, // no stamp — skipped
      { completedAt: '2026-06-26T17:10:00Z' },
    ]);
    expect(d.durationMin).toBe(30);
  });

  it('exposes the documented 2-minute cluster threshold', () => {
    expect(CLUSTER_THRESHOLD_MIN).toBe(2);
  });
});
