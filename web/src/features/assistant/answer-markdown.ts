import type { MarkdownNode } from "@slotted/core/markdown";

// Workaround for Slotted finding "The markdown family needs an outside parser for plain CommonMark":
// the family draws an mdast tree and ships only an adapter for the `marked` lexer, which this
// application does not install. This subset parser covers what the assistant is told to write
// (paragraphs, lists, bold, links to a screen, GFM tables); any other syntax stays literal text.

const inlinePattern = /\*\*([^*\n]+)\*\*|\[([^\]\n]+)\]\(([^)\s]*)\)/g;

function text(value: string): MarkdownNode {
  return { type: "text", value };
}

function inline(source: string): MarkdownNode[] {
  const nodes: MarkdownNode[] = [];
  const push = (node: MarkdownNode) => {
    const last = nodes[nodes.length - 1];
    if (node.type === "text" && last?.type === "text") {
      nodes[nodes.length - 1] = text((last.value ?? "") + (node.value ?? ""));
    } else {
      nodes.push(node);
    }
  };
  let at = 0;
  for (const m of source.matchAll(inlinePattern)) {
    push(text(source.slice(at, m.index)));
    at = m.index + m[0].length;
    const url = m[3] ?? "";
    if (m[1] !== undefined) {
      push({ type: "strong", children: [text(m[1])] });
    } else if (url.startsWith("/") && !url.startsWith("//")) {
      push({ type: "link", url, children: [text(m[2] ?? "")] });
    } else {
      push(text(m[0]));
    }
  }
  push(text(source.slice(at)));
  return nodes.filter((n) => n.type !== "text" || n.value !== "");
}

type Kind = "bullet" | "ordered" | "plain";

const bullet = /^[-*] +(.*)$/;
const ordered = /^(\d+)\. +(.*)$/;

function classify(line: string): { kind: Kind; body: string; start: number } {
  const b = bullet.exec(line);
  if (b !== null) return { kind: "bullet", body: b[1] ?? "", start: 1 };
  const o = ordered.exec(line);
  if (o !== null)
    return { kind: "ordered", body: o[2] ?? "", start: Number(o[1]) };
  return { kind: "plain", body: line, start: 1 };
}

// The cells of a table line, without its outer pipes; null when the line is not one.
function cells(line: string): string[] | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|")) return null;
  const inner = trimmed.slice(1, trimmed.endsWith("|") ? -1 : undefined);
  return inner.split("|").map((cell) => cell.trim());
}

const delimiterCell = /^(:?)-{3,}(:?)$/;

// The alignment of each column, or null when the line is no delimiter row of that width.
function alignments(
  line: string,
  width: number,
): ("left" | "right" | "center" | null)[] | null {
  const row = cells(line);
  if (row?.length !== width) return null;
  const out: ("left" | "right" | "center" | null)[] = [];
  for (const cell of row) {
    const m = delimiterCell.exec(cell);
    if (m === null) return null;
    out.push(
      m[1] !== "" && m[2] !== ""
        ? "center"
        : m[2] !== ""
          ? "right"
          : m[1] !== ""
            ? "left"
            : null,
    );
  }
  return out;
}

function tableRow(row: string[], width: number): MarkdownNode {
  return {
    type: "tableRow",
    children: Array.from({ length: width }, (_, i) => ({
      type: "tableCell",
      children: inline(row[i] ?? ""),
    })),
  };
}

export function parseAnswer(source: string): MarkdownNode {
  const blocks: MarkdownNode[] = [];
  let kind: Kind | null = null;
  let lines: string[] = [];
  let start = 1;
  const flush = () => {
    if (kind === null) return;
    if (kind === "plain") {
      blocks.push({ type: "paragraph", children: inline(lines.join("\n")) });
    } else {
      blocks.push({
        type: "list",
        ordered: kind === "ordered",
        start: kind === "ordered" ? start : null,
        spread: false,
        children: lines.map((line) => ({
          type: "listItem",
          spread: false,
          children: [{ type: "paragraph", children: inline(line) }],
        })),
      });
    }
    kind = null;
    lines = [];
  };
  const all = source.split(/\r?\n/);
  for (let i = 0; i < all.length; i++) {
    const raw = all[i] ?? "";
    if (raw.trim() === "") {
      flush();
      continue;
    }
    // A header row, a delimiter row of the same width, then the body rows that follow (GFM).
    const header = cells(raw);
    const align =
      header === null ? null : alignments(all[i + 1] ?? "", header.length);
    if (header !== null && align !== null) {
      flush();
      const rows = [tableRow(header, header.length)];
      i += 2;
      for (; i < all.length; i++) {
        const row = cells(all[i] ?? "");
        if (row === null) break;
        rows.push(tableRow(row, header.length));
      }
      i--;
      blocks.push({ type: "table", align, children: rows });
      continue;
    }
    const line = classify(raw.trim());
    if (line.kind !== kind) {
      flush();
      kind = line.kind;
      start = line.start;
    }
    lines.push(line.kind === "plain" ? raw.trim() : line.body);
  }
  flush();
  return { type: "root", children: blocks };
}
