import { describe, expect, it } from "vitest";

import { newRouter, routeTree } from "@/app/router";

import { matchScreen, navigationMap } from "@/navigation/navigation-map.ts";

interface RouteNode {
  fullPath?: string;
  children?: unknown;
}

function fullPaths(node: RouteNode, out: Set<string>): Set<string> {
  if (node.fullPath !== undefined) {
    out.add(
      node.fullPath.length > 1
        ? node.fullPath.replace(/\/$/, "")
        : node.fullPath,
    );
  }
  const children = node.children;
  const list = Array.isArray(children)
    ? children
    : Object.values(children ?? {});
  for (const child of list) fullPaths(child as RouteNode, out);
  return out;
}

// Building a router assigns each route its fullPath.
newRouter();
const routes = fullPaths(routeTree as RouteNode, new Set());
// /offline opens without the server, where no assistant answers (P3 of ADR 022); /setup opens
// before the first user exists, who could ask one (W-U6 of the Windows design).
const unmapped = new Set([
  "/login",
  "/offline",
  "/setup",
  "/preview/account-card",
  "/accounts",
  "",
]);

describe("navigation map", () => {
  it("reads the routes of the router", () => {
    expect(routes.size).toBeGreaterThan(20);
  });

  it("lists only routes of the router", () => {
    for (const screen of navigationMap) {
      expect(routes, screen.path).toContain(screen.path);
    }
  });

  it("lists every route except the ones the assistant never links", () => {
    const mapped = new Set(navigationMap.map((s) => s.path));
    const missing = [...routes].filter(
      (p) => !mapped.has(p) && !unmapped.has(p),
    );
    expect(missing).toEqual([]);
  });

  it("matches a path with filled parameters", () => {
    expect(matchScreen("/cards/3f2a/statements/9b1c")?.path).toBe(
      "/cards/$accountId/statements/$statementId",
    );
    expect(matchScreen("/nope")).toBeUndefined();
  });
});
