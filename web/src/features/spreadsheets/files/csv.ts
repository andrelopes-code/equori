// The delimiters a CSV file of a bank, a broker or a spreadsheet uses.
const delimiters = [",", ";", "\t"] as const;

export type Delimiter = (typeof delimiters)[number];

// The rows of a CSV text (RFC 4180): a field in double quotes holds delimiters, line breaks and
// doubled quotes. The delimiter is the one that occurs most outside quotes in the first line.
export function parseCsv(text: string): string[][] {
  // A file of a desktop spreadsheet starts with a byte order mark.
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const delimiter = detectDelimiter(source);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < source.length; i++) {
    const char = source.charAt(i);

    if (quoted) {
      if (char !== '"') field += char;
      else if (source.charAt(i + 1) === '"') {
        field += '"';
        i++;
      } else quoted = false;
      continue;
    }

    if (char === '"' && field === "") quoted = true;
    else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source.charAt(i + 1) === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += char;
  }

  // A text that ends without a line break still holds its last row.
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

// The CSV text of rows, with CRLF line ends. A field is quoted when it holds the delimiter, a
// quote or a line break.
export function formatCsv(
  rows: readonly (readonly unknown[])[],
  delimiter: Delimiter = ",",
): string {
  return rows
    .map((row) =>
      row.map((value) => formatField(value, delimiter)).join(delimiter),
    )
    .join("\r\n");
}

// The value of a CSV field as a cell holds it: a number when the text is one, the text
// otherwise. With the delimiter ";" the decimal sign is a comma, as in the files of a country
// that writes "1.234,56".
export function fieldValue(
  field: string,
  delimiter: Delimiter,
): string | number {
  const text = field.trim();
  const plain =
    delimiter === ";" && /^-?(\d{1,3}(\.\d{3})+|\d+)(,\d+)?$/.test(text)
      ? text.replaceAll(".", "").replace(",", ".")
      : text;

  return /^-?\d+(\.\d+)?$/.test(plain) && !/^-?0\d/.test(plain)
    ? Number(plain)
    : field;
}

export function detectDelimiter(text: string): Delimiter {
  const counts = new Map<Delimiter, number>(delimiters.map((d) => [d, 0]));
  let quoted = false;

  for (const char of text) {
    if (char === '"') quoted = !quoted;
    else if (!quoted && (char === "\n" || char === "\r")) break;
    else if (!quoted && counts.has(char as Delimiter))
      counts.set(char as Delimiter, (counts.get(char as Delimiter) ?? 0) + 1);
  }

  return delimiters.reduce((best, d) =>
    (counts.get(d) ?? 0) > (counts.get(best) ?? 0) ? d : best,
  );
}

function formatField(value: unknown, delimiter: Delimiter): string {
  if (value === null || value === undefined) return "";

  const text =
    typeof value === "string"
      ? value
      : typeof value === "number" || typeof value === "boolean"
        ? String(value)
        : JSON.stringify(value);

  return text.includes(delimiter) || /["\r\n]/.test(text)
    ? `"${text.replaceAll('"', '""')}"`
    : text;
}
