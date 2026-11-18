export type InlinePart =
  | { type: "text"; text: string }
  | { type: "strong"; text: string }
  | { type: "link"; text: string; href: string };

const MARK = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;

// The line of a step where no block may stand (a button, a caption): its strong words and its
// links, the rest as text.
export function inlineParts(markdown: string): InlinePart[] {
  const line = markdown.replace(/\s*\n\s*/g, " ").replace(/`/g, "");
  const parts: InlinePart[] = [];
  let end = 0;

  for (const match of line.matchAll(MARK)) {
    const [whole, strong, label, href] = match;

    if (match.index > end) {
      parts.push({ type: "text", text: line.slice(end, match.index) });
    }

    if (strong !== undefined) parts.push({ type: "strong", text: strong });
    else if (label !== undefined && href !== undefined) {
      parts.push({ type: "link", text: label, href });
    }

    end = match.index + whole.length;
  }

  if (end < line.length) parts.push({ type: "text", text: line.slice(end) });

  return parts;
}
