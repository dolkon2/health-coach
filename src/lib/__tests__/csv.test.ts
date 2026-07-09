/**
 * csv.test.ts — generic CSV parsing (Body P5): delimiter sniff, RFC-4180
 * quoting, BOM stripping.
 */
import { describe, expect, it } from '@jest/globals';
import { colIndex, parseCsv, sniffDelimiter } from '../csv';

describe('sniffDelimiter', () => {
  it('picks comma when commas outnumber semicolons', () => {
    expect(sniffDelimiter('Date,Workout Name,Exercise Name')).toBe(',');
  });
  it('picks semicolon when semicolons outnumber commas', () => {
    expect(sniffDelimiter('Date;Workout Name;Exercise Name')).toBe(';');
  });
});

describe('parseCsv', () => {
  it('parses a simple comma file', () => {
    const { headers, rows } = parseCsv('a,b,c\n1,2,3\n4,5,6\n');
    expect(headers).toEqual(['a', 'b', 'c']);
    expect(rows).toEqual([
      ['1', '2', '3'],
      ['4', '5', '6'],
    ]);
  });

  it('handles quoted fields with embedded commas and escaped quotes', () => {
    const csv = 'Name,Notes\n"Bench Press","paused last rep, elbow ""clicked"""\n';
    const { rows } = parseCsv(csv);
    expect(rows[0]).toEqual(['Bench Press', 'paused last rep, elbow "clicked"']);
  });

  it('handles a quoted field spanning an embedded newline', () => {
    const csv = 'a,b\n"line one\nline two",x\n';
    const { rows } = parseCsv(csv);
    expect(rows[0]).toEqual(['line one\nline two', 'x']);
  });

  it('strips a leading UTF-8 BOM', () => {
    const csv = '﻿a,b\n1,2\n';
    const { headers } = parseCsv(csv);
    expect(headers).toEqual(['a', 'b']);
  });

  it('sniffs semicolon delimiter and parses accordingly', () => {
    const csv = 'a;b;c\n1;2;3\n';
    const { headers, rows } = parseCsv(csv);
    expect(headers).toEqual(['a', 'b', 'c']);
    expect(rows[0]).toEqual(['1', '2', '3']);
  });

  it('normalizes CRLF line endings', () => {
    const csv = 'a,b\r\n1,2\r\n3,4\r\n';
    const { rows } = parseCsv(csv);
    expect(rows).toEqual([
      ['1', '2'],
      ['3', '4'],
    ]);
  });

  it('returns an empty table for empty input', () => {
    expect(parseCsv('')).toEqual({ headers: [], rows: [] });
  });
});

describe('colIndex', () => {
  it('matches case/space-insensitively across aliases', () => {
    const headers = ['Date', 'Workout Name', 'Weight Unit'];
    expect(colIndex(headers, 'date')).toBe(0);
    expect(colIndex(headers, 'workout name')).toBe(1);
    expect(colIndex(headers, 'weight unit')).toBe(2);
  });

  it('returns -1 when no alias matches', () => {
    expect(colIndex(['Date'], 'exercise name')).toBe(-1);
  });
});
