import type { MarkdownNode } from "@slotted/core/markdown";
import { describe, expect, it } from "vitest";

import { parseAnswer } from "@/features/assistant/answer-markdown";

function find(node: MarkdownNode, type: string): MarkdownNode[] {
  return [
    ...(node.type === type ? [node] : []),
    ...(node.children ?? []).flatMap((child) => find(child, type)),
  ];
}

function text(node: MarkdownNode): string {
  return (
    (node.value ?? "") + (node.children ?? []).map((c) => text(c)).join("")
  );
}

describe("parseAnswer", () => {
  it("reads paragraphs, lists, bold and a link to a screen", () => {
    const tree = parseAnswer("Total:\n\n- **Food** 10\n- [Cards](/cards)");
    expect((tree.children ?? []).map((n) => n.type)).toEqual([
      "paragraph",
      "list",
    ]);
    const list = find(tree, "list")[0];
    expect(list?.ordered).toBe(false);
    expect(find(tree, "listItem")).toHaveLength(2);
    expect(find(tree, "strong").map(text)).toEqual(["Food"]);
    expect(find(tree, "link")[0]?.url).toBe("/cards");
  });

  it("reads a numbered list", () => {
    const list = find(parseAnswer("1. one\n2. two"), "list")[0];
    expect(list?.ordered).toBe(true);
    expect(list?.children).toHaveLength(2);
  });

  it("keeps a link with another scheme as literal text", () => {
    const tree = parseAnswer("[x](javascript:alert(1))");
    expect(find(tree, "link")).toHaveLength(0);
    expect(text(tree)).toBe("[x](javascript:alert(1))");
  });

  it("keeps a protocol-relative link as literal text", () => {
    expect(find(parseAnswer("[x](//evil.test)"), "link")).toHaveLength(0);
  });

  it("keeps a heading marker as literal text", () => {
    const tree = parseAnswer("# Title");
    expect(find(tree, "heading")).toHaveLength(0);
    expect(text(tree)).toBe("# Title");
  });
});
