import { monthStart, monthLabel, shiftMonth, monthCells } from '../logbookCalendar';

describe('logbookCalendar', () => {
  describe('monthStart', () => {
    it('returns the first day of the containing month', () => {
      expect(monthStart('2026-06-15')).toBe('2026-06-01');
      expect(monthStart('2026-01-31')).toBe('2026-01-01');
    });
  });

  describe('monthLabel', () => {
    it('names the month and year', () => {
      expect(monthLabel('2026-06-01')).toBe('June 2026');
      expect(monthLabel('2026-12-25')).toBe('December 2026');
    });
  });

  describe('shiftMonth', () => {
    it('walks forward and backward by month, as the first day', () => {
      expect(shiftMonth('2026-06-15', 1)).toBe('2026-07-01');
      expect(shiftMonth('2026-06-15', -1)).toBe('2026-05-01');
    });
    it('crosses year boundaries', () => {
      expect(shiftMonth('2026-12-10', 1)).toBe('2027-01-01');
      expect(shiftMonth('2026-01-10', -1)).toBe('2025-12-01');
    });
    it('handles multi-month jumps', () => {
      expect(shiftMonth('2026-06-01', 12)).toBe('2027-06-01');
      expect(shiftMonth('2026-03-01', -5)).toBe('2025-10-01');
    });
  });

  describe('monthCells', () => {
    it('always returns a fixed 42-cell (6×7) grid', () => {
      expect(monthCells('2026-06-15')).toHaveLength(42);
      // February 2026 starts on a Sunday — still padded to 6 rows.
      expect(monthCells('2026-02-10')).toHaveLength(42);
    });

    it('is Sunday-first, leading with the correct pad days', () => {
      // June 1 2026 is a Monday → one leading day (Sun May 31), not in-month.
      const cells = monthCells('2026-06-01');
      expect(cells[0]).toEqual({ date: '2026-05-31', inMonth: false });
      expect(cells[1]).toEqual({ date: '2026-06-01', inMonth: true });
    });

    it('flags in-month days and trailing pad days', () => {
      const cells = monthCells('2026-06-01');
      const inMonth = cells.filter((c) => c.inMonth);
      // June has 30 days.
      expect(inMonth).toHaveLength(30);
      expect(inMonth[0].date).toBe('2026-06-01');
      expect(inMonth[29].date).toBe('2026-06-30');
      // The last cell is a July trailing pad day.
      expect(cells[41].inMonth).toBe(false);
      expect(cells[41].date.startsWith('2026-07')).toBe(true);
    });

    it('starts every grid on a Sunday', () => {
      for (const anchor of ['2026-01-15', '2026-02-15', '2026-11-15', '2027-03-15']) {
        const [y, m, d] = monthCells(anchor)[0].date.split('-').map(Number);
        expect(new Date(y, m - 1, d).getDay()).toBe(0);
      }
    });
  });
});
