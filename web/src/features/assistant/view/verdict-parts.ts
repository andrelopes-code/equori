export interface VerdictPart {
  text: string;
  strong: boolean;
}

// A param rendered as \u0001name\u0002 marks where a figure sits in the translated sentence.
export const OPEN = "\u0001";
export const CLOSE = "\u0002";

// The verdict as runs of text, with each figure apart so it can be drawn in bold (V8).
export function verdictParts(
  rendered: string,
  values: Record<string, string>,
): VerdictPart[] {
  const parts: VerdictPart[] = [];
  const pattern = new RegExp(`${OPEN}([a-z_]+)${CLOSE}`, "g");
  let last = 0;

  for (const match of rendered.matchAll(pattern)) {
    if (match.index > last)
      parts.push({ text: rendered.slice(last, match.index), strong: false });
    parts.push({ text: values[match[1] ?? ""] ?? "", strong: true });
    last = match.index + match[0].length;
  }

  if (last < rendered.length)
    parts.push({ text: rendered.slice(last), strong: false });

  return parts;
}
