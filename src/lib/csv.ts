/**
 * csv.ts — generic CSV parsing (Body P5). No app-specific knowledge; the
 * Strong/Hevy mappers sit on top of this. Handles the three real-world
 * hazards format-spec.md documented against actual exports:
 *   - delimiter: Strong's Android exports are semicolon-delimited, iOS comma.
 *   - RFC-4180 quoting: double-quoted fields, `""` escaping, embedded
 *     delimiters/newlines inside quotes.
 *   - a leading UTF-8 BOM (`﻿`), seen in some exports.
 */

export type CsvTable = { headers: string[]; rows: string[][] };

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/** Sniffs `,` vs `;` from the header line only — more semicolons than commas
 *  means semicolon-delimited (Strong's Android export convention). */
export function sniffDelimiter(headerLine: string): ',' | ';' {
  const commas = (headerLine.match(/,/g) ?? []).length;
  const semicolons = (headerLine.match(/;/g) ?? []).length;
  return semicolons > commas ? ';' : ',';
}

/** RFC-4180 field-aware record splitting — a naive `.split(delimiter)` breaks
 *  on a quoted field containing the delimiter, a quote (`""` escape), or an
 *  embedded newline. Normalizes CRLF/CR to LF. */
function parseRecords(text: string, delimiter: string): string[][] {
  const records: string[][] = [];
  let field = '';
  let record: string[] = [];
  let inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === delimiter) {
      record.push(field);
      field = '';
      i++;
      continue;
    }
    if (c === '\r') {
      i++;
      continue;
    }
    if (c === '\n') {
      record.push(field);
      records.push(record);
      record = [];
      field = '';
      i++;
      continue;
    }
    field += c;
    i++;
  }
  if (field.length > 0 || record.length > 0) {
    record.push(field);
    records.push(record);
  }
  // Drop fully-blank trailing lines (a lone empty field from a trailing newline).
  return records.filter((r) => !(r.length === 1 && r[0] === ''));
}

/** Parses raw CSV text into a header row + data rows. Empty input yields an
 *  empty table, never a throw — callers decide what "no rows" means. */
export function parseCsv(raw: string): CsvTable {
  const text = stripBom(raw);
  const firstLineEnd = text.indexOf('\n');
  const headerLine = firstLineEnd >= 0 ? text.slice(0, firstLineEnd) : text;
  const delimiter = sniffDelimiter(headerLine);
  const records = parseRecords(text, delimiter);
  if (records.length === 0) return { headers: [], rows: [] };
  const [headerRow, ...rows] = records;
  return { headers: headerRow.map((h) => h.trim()), rows };
}

/** Finds a column index by any of several case/space-insensitive aliases;
 *  -1 when none of the aliases are present in this file's header. */
export function colIndex(headers: string[], ...aliases: string[]): number {
  const norm = (s: string) => s.trim().toLowerCase();
  const wanted = new Set(aliases.map(norm));
  return headers.findIndex((h) => wanted.has(norm(h)));
}
