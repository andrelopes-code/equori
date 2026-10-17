import { describe, expect, it } from "vitest";

import { bestMatch } from "@/ui/best-match";

const paths = ["/", "/transactions", "/transactions/new", "/accounts"];

describe("bestMatch", () => {
  it.each([
    ["/", "/"],
    ["/transactions", "/transactions"],
    ["/transactions/abc", "/transactions"],
    ["/transactions/abc/correct", "/transactions"],
    ["/transactions/new", "/transactions/new"],
    ["/accounts/abc", "/accounts"],
    ["/accountsX", undefined],
    ["/transactionsX/new", undefined],
    ["/settings", undefined],
  ])("%s -> %s", (pathname, expected) => {
    expect(bestMatch(pathname, paths)).toBe(expected);
  });
});
