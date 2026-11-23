// Whether a number format writes a date or a time: it holds a letter of a date or of a time
// outside its quoted texts, its bracketed sections and its escaped characters.
export function isDatePattern(pattern: string | null | undefined): boolean {
  if (pattern === null || pattern === undefined || /general/i.test(pattern))
    return false;

  const bare = pattern
    .replace(/"[^"]*"/g, "")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\\./g, "");

  return /[ymdhs]/i.test(bare);
}

// The values of a sheet for a file of plain values: a number as the cell holds it, so another
// program reads it whatever the format, and a date or a time as the cell shows it, since its
// number is a count of days.
export function sheetRows(
  raw: readonly (readonly unknown[])[],
  shown: readonly (readonly string[])[],
  patterns: readonly (readonly (string | null | undefined)[])[],
): unknown[][] {
  return raw.map((row, r) =>
    row.map((value, c) =>
      typeof value === "number" && isDatePattern(patterns[r]?.[c])
        ? (shown[r]?.[c] ?? value)
        : value,
    ),
  );
}
