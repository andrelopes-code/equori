import type { MarkdownNode } from "@slotted/core/markdown";

import { MASK } from "@/privacy/mask";

// A formatted amount of any scale-2 currency in either decimal convention, with the symbol that
// precedes it ("R$ 1.234,56", "$1,234.56", "1234.56"). It matches a superset of the pattern of
// testing/privacy.ts, so a text it masked passes expectNoAmounts.
const amountPattern =
  /(?:[A-Z]{0,3}\p{Sc}\s?)?\d+(?:[.,\s]\d{3})*[.,]\d{2}(?!\d)/gu;
const symbolPattern = /^[A-Z]{0,3}\p{Sc}/u;

// Mirrors useMoneyFormat() while hidden: the symbol, a space and the mask.
export function maskMatch(match: string): string {
  const symbol = symbolPattern.exec(match)?.[0];
  return symbol === undefined ? MASK : `${symbol} ${MASK}`;
}

export function maskAmountText(text: string): string {
  return text.replace(amountPattern, maskMatch);
}

export function maskAmounts(
  tree: MarkdownNode,
  mask: (text: string) => string,
): MarkdownNode {
  if (tree.type === "text" && tree.value !== undefined) {
    return { ...tree, value: tree.value.replace(amountPattern, mask) };
  }
  if (tree.children === undefined) return tree;
  return { ...tree, children: tree.children.map((c) => maskAmounts(c, mask)) };
}
