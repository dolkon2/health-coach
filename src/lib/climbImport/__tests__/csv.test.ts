/**
 * The Proof — parseCsv handles what real exporters actually produce:
 *   1. Plain comma-separated rows split correctly, header separated from data.
 *   2. A quoted field with an embedded comma stays one cell, not two.
 *   3. An escaped quote ("") inside a quoted field decodes to one quote char.
 *   4. CRLF and LF line endings both work; a trailing blank line is dropped,
 *      never returned as a fabricated empty row.
 *   5. rowToRecord maps by header name, not position, and a short row leaves
 *      the missing trailing column absent — never a fabricated ''.
 */
import { describe, it, expect } from '@jest/globals';
import { parseCsv, rowToRecord } from '../csv';

describe('parseCsv', () => {
  it('splits plain comma-separated rows and separates the header', () => {
    const { header, rows } = parseCsv('a,b,c\n1,2,3\n4,5,6\n');
    expect(header).toEqual(['a', 'b', 'c']);
    expect(rows).toEqual([
      ['1', '2', '3'],
      ['4', '5', '6'],
    ]);
  });

  it('keeps a quoted field with an embedded comma as one cell', () => {
    const { rows } = parseCsv('a,b\n1,"hello, world"\n');
    expect(rows).toEqual([['1', 'hello, world']]);
  });

  it('decodes an escaped double-quote inside a quoted field', () => {
    const { rows } = parseCsv('a,b\n1,"she said ""hi"""\n');
    expect(rows).toEqual([['1', 'she said "hi"']]);
  });

  it('handles a quoted field spanning an embedded newline', () => {
    const { rows } = parseCsv('a,b\n1,"line one\nline two"\n');
    expect(rows).toEqual([['1', 'line one\nline two']]);
  });

  it('handles CRLF line endings the same as LF', () => {
    const { header, rows } = parseCsv('a,b\r\n1,2\r\n3,4\r\n');
    expect(header).toEqual(['a', 'b']);
    expect(rows).toEqual([
      ['1', '2'],
      ['3', '4'],
    ]);
  });

  it('drops a trailing blank line rather than returning a fabricated empty row', () => {
    const { rows } = parseCsv('a,b\n1,2\n\n');
    expect(rows).toEqual([['1', '2']]);
  });

  it('parses a file with no trailing newline', () => {
    const { rows } = parseCsv('a,b\n1,2');
    expect(rows).toEqual([['1', '2']]);
  });
});

describe('rowToRecord', () => {
  it('maps cells to header names', () => {
    expect(rowToRecord(['a', 'b', 'c'], ['1', '2', '3'])).toEqual({ a: '1', b: '2', c: '3' });
  });

  it('leaves a missing trailing column absent, never a fabricated empty string', () => {
    const rec = rowToRecord(['a', 'b', 'c'], ['1', '2']);
    expect(rec).toEqual({ a: '1', b: '2' });
    expect('c' in rec).toBe(false);
  });
});
