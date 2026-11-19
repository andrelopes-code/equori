export interface CopySource {
  title: string;
  window: string;
  verdict: string;
  head: string[];
  rows: string[][];
}

// The view as plain text for the clipboard (V14). The figures arrive formatted, so privacy masks them.
export function viewCopy(s: CopySource): string {
  const heading = s.window === "" ? s.title : `${s.title} · ${s.window}`;
  const lines = [heading, s.verdict];

  if (s.rows.length > 0) {
    lines.push("", s.head.join("\t"), ...s.rows.map((r) => r.join("\t")));
  }

  return lines.join("\n");
}
