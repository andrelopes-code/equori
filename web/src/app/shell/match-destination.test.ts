import { describe, expect, it } from "vitest";

import { matchDestination } from "@/app/shell/match-destination";

describe("matchDestination", () => {
  it.each([
    ["/", "overview", true],
    ["/transactions", "transactions", true],
    ["/transactions/abc", "transactions", false],
    ["/transactions/new", "transactions", false],
    ["/transactions/abc/correct", "transactions", false],
    ["/accounts/x", "accounts", false],
    ["/cards", "cards", true],
    ["/cards/x", "cards", false],
    ["/goals", "goals", true],
    ["/settings", "settings", true],
  ])("matches %s to %s (top level: %s)", (pathname, key, topLevel) => {
    const match = matchDestination(pathname);
    expect(match.destination?.key).toBe(key);
    expect(match.topLevel).toBe(topLevel);
  });

  it("matches no destination for a path that only shares a prefix", () => {
    expect(matchDestination("/cardsx")).toEqual({
      destination: undefined,
      topLevel: false,
    });
  });
});
