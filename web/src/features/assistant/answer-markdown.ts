import { parseMarkdown } from "@slotted/core/markdown";
import type { MarkdownNode } from "@slotted/core/markdown";

// What the assistant is told to write, and the headings and rules it writes anyway (drawn by
// plainAnswer); any other syntax stays literal text.
const allow = [
  "heading",
  "thematicBreak",
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
  return screenLinksOnly(plainAnswer(parseMarkdown(source, { allow })));
}

// An answer draws no heading and no rule: a heading becomes a bold paragraph, a rule is dropped.
function plainAnswer(node: MarkdownNode): MarkdownNode {
  if (node.type === "heading") {
    const children = (node.children ?? []).map(plainAnswer);

    return {
      type: "paragraph",
      children: [{ type: "strong", children }],
    };
  }

  if (node.children === undefined) return node;

  return {
    ...node,
    children: node.children
      .filter((child) => child.type !== "thematicBreak")
      .map(plainAnswer),
  };
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
