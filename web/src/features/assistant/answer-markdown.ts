import { parseMarkdown } from "@slotted/core/markdown";
import type { MarkdownNode } from "@slotted/core/markdown";

// What the assistant is told to write; any other syntax stays literal text.
const allow = [
  "root",
  "paragraph",
  "text",
  "list",
  "listItem",
  "strong",
  "link",
  "table",
  "tableRow",
  "tableCell",
];

export function parseAnswer(source: string): MarkdownNode {
  return screenLinksOnly(parseMarkdown(source, { allow }));
}

// A link the assistant writes leads to a screen of the application; any other is written back as
// the text it came from.
function screenLinksOnly(node: MarkdownNode): MarkdownNode {
  const url = node.url ?? "";
  if (node.type === "link" && (!url.startsWith("/") || url.startsWith("//"))) {
    return { type: "text", value: `[${textOf(node)}](${url})` };
  }

  if (node.children === undefined) return node;

  return { ...node, children: node.children.map(screenLinksOnly) };
}

function textOf(node: MarkdownNode): string {
  return (node.value ?? "") + (node.children ?? []).map(textOf).join("");
}
