/**
 * csv.ts — minimal RFC4180 CSV parsing (dimension/earth, Pass E5).
 *
 * Hand-rolled rather than a dependency (⚑ E-12, dev-log/dimension-earth-
 * build.md: "prefer adding nothing" — this is a small, well-specified format
 * and every climbing-import row needs it, not a whole parsing library).
 * Handles what real exporters (BoardLib/Python csv module) actually produce:
 * quoted fields, embedded commas/newlines inside quotes, "" as an escaped
 * quote, and either CRLF or LF line endings. Does not handle multi-char
 * delimiters or non-comma dialects — narrow to what this app's import
 * sources use.
 */

/** One parsed CSV document: the header row (verbatim) and the data rows. */
export type ParsedCsv = {
  header: string[];
  rows: string[][];
};

/**
 * Parses CSV text into rows of raw string cells. The first row is returned
 * separately as `header`; blank trailing lines are skipped. Ragged rows
 * (wrong cell count vs the header) are returned as-is — callers decide
 * whether to skip them, since "wrong shape" is a per-format policy, not a
 * parsing concern.
 */
export function parseCsv(text: string): ParsedCsv {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const n = text.length;

  function endField() {
    row.push(field);
    field = '';
  }
  function endRow() {
    endField();
    rows.push(row);
    row = [];
  }

  while (i < n) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += c;
      i += 1;
      continue;
    }
    if (c === '"' && field === '') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (c === ',') {
      endField();
      i += 1;
      continue;
    }
    if (c === '\r') {
      i += 1; // swallow; a following \n (or none, for a bare \r file) ends the row
      continue;
    }
    if (c === '\n') {
      endRow();
      i += 1;
      continue;
    }
    field += c;
    i += 1;
  }
  // A final line with no trailing newline still needs its row closed; an
  // empty trailing field/row (file ends in a newline) is dropped, not
  // pushed as a fabricated blank row.
  if (field !== '' || row.length > 0) endRow();

  const [header, ...dataRows] = rows;
  return { header: header ?? [], rows: dataRows.filter((r) => r.some((cell) => cell !== '')) };
}

/** Maps a row's cells onto its header, by exact column name. Missing columns are absent, never ''. */
export function rowToRecord(header: string[], row: string[]): Record<string, string> {
  const rec: Record<string, string> = {};
  header.forEach((name, idx) => {
    if (row[idx] !== undefined) rec[name] = row[idx];
  });
  return rec;
}
