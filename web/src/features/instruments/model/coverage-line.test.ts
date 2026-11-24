import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import {
  coverageRange,
  historyState,
  quoteAge,
} from "@/features/instruments/model/coverage-line";

type Coverage = components["schemas"]["InstrumentCoverage"];
type Source = Coverage["sources"][number];

const source = (over: Partial<Source>): Source => ({
  id: "b3_cotahist",
  enabled: true,
  official: true,
  first: null,
  last: null,
  history: null,
  ...over,
});

const coverage = (
  sources: Source[],
  over: Partial<Coverage> = {},
): Coverage => ({
  first: "2026-10-14",
  last: "2026-10-16",
  count: 2,
  stale: false,
  missing: 0,
  sources,
  ...over,
});

describe("coverageRange", () => {
  it("names the source with the latest last date, the first on a tie", () => {
    const c = coverage([
      source({ id: "a", last: "2026-10-15" }),
      source({ id: "b", last: "2026-10-16" }),
      source({ id: "c", last: "2026-10-16" }),
    ]);

    expect(coverageRange(c)).toEqual({
      kind: "range",
      first: "2026-10-14",
      last: "2026-10-16",
      count: 2,
      source: "b",
    });
  });

  it("has no source when no item has a last date", () => {
    expect(coverageRange(coverage([source({})]))).toMatchObject({
      kind: "range",
      source: null,
    });
  });

  it("is none without a first or last date, and canRequest follows enabled", () => {
    const none = { first: null, last: null, count: 0 };

    expect(coverageRange(coverage([source({})], none))).toEqual({
      kind: "none",
      canRequest: true,
    });
    expect(coverageRange(coverage([source({ enabled: false })], none))).toEqual(
      { kind: "none", canRequest: false },
    );
  });
});

describe("historyState", () => {
  const history = (over: Partial<NonNullable<Source["history"]>>) => ({
    from: "2006-10-17",
    done: false,
    error: null,
    ...over,
  });

  it("is idle without a history row", () => {
    expect(historyState(coverage([source({})]))).toEqual({ kind: "idle" });
  });

  it("is loading with the earliest from among the rows not done", () => {
    const c = coverage([
      source({ id: "a", history: history({ from: "2010-01-01" }) }),
      source({ id: "b", history: history({ from: "2006-10-17" }) }),
      source({ id: "c", history: history({ from: "1999-01-01", done: true }) }),
    ]);

    expect(historyState(c)).toEqual({ kind: "loading", from: "2006-10-17" });
  });

  it("is idle when every row is done", () => {
    const c = coverage([source({ history: history({ done: true }) })]);

    expect(historyState(c)).toEqual({ kind: "idle" });
  });

  it("is failed with the first error", () => {
    const c = coverage([
      source({ id: "a", history: history({}) }),
      source({ id: "b", history: history({ error: "boom" }) }),
      source({ id: "c", history: history({ error: "later" }) }),
    ]);

    expect(historyState(c)).toEqual({
      kind: "failed",
      from: "2006-10-17",
      error: "boom",
    });
  });

  it("ignores a disabled source", () => {
    const c = coverage([
      source({ enabled: false, history: history({ error: "boom" }) }),
    ]);

    expect(historyState(c)).toEqual({ kind: "idle" });
  });
});

describe("quoteAge", () => {
  it("counts the days from last to today when no item is enabled", () => {
    const c = coverage([source({ enabled: false })], { last: "2026-10-12" });

    expect(quoteAge(c, "2026-10-17")).toBe(5);
  });

  it("is null when an item is enabled", () => {
    expect(quoteAge(coverage([source({})]), "2026-10-17")).toBeNull();
  });

  it("is null without a last date", () => {
    const c = coverage([], { last: null });

    expect(quoteAge(c, "2026-10-17")).toBeNull();
  });
});
