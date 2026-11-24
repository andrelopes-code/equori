import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import {
  feedHasProblem,
  feedStatus,
  isActive,
  summarizeFeeds,
} from "@/features/setup/market-data/feed-status";

type Feed = components["schemas"]["MarketDataFeed"];

function feed(patch: Partial<Feed> = {}): Feed {
  return {
    id: "br_cdi",
    kind: "index",
    enabled: true,
    suggested: false,
    last: "2026-11-12",
    stale: false,
    missing: 0,
    last_run: null,
    activity: "idle",
    error: null,
    official: true,
    covers: 0,
    history_pending: 0,
    symbol_override: false,
    current: false,
    current_at: null,
    current_error: null,
    ...patch,
  };
}

describe("feedStatus", () => {
  it.each([
    [{}, "upToDate", "ok"],
    [{ stale: true }, "overdue", "warning"],
    [{ error: "HTTP 503" }, "failed", "danger"],
    [{ error: "HTTP 503", stale: true }, "failed", "danger"],
    [{ missing: 2 }, "incomplete", "warning"],
    [{ missing: 2, stale: true }, "overdue", "warning"],
    [{ activity: "running" }, "updating", "muted"],
    [{ activity: "running", last: null }, "loading", "muted"],
    [{ activity: "running", history_pending: 1 }, "loading", "muted"],
    [{ activity: "running", error: "HTTP 503" }, "updating", "muted"],
    [{ activity: "queued" }, "upToDate", "ok"],
    [{ activity: "queued", last: null }, "queued", "muted"],
    [{ activity: "queued", history_pending: 1 }, "queued", "muted"],
    [{ enabled: false, activity: "running" }, "disabled", "muted"],
    [{ last: null }, "noData", "muted"],
    [{ enabled: false }, "disabled", "muted"],
    [{ enabled: false, error: "HTTP 503", stale: true }, "disabled", "muted"],
  ] as const)("reads %j as %s", (patch, word, tone) => {
    expect(feedStatus(feed(patch))).toEqual({ word, tone });
  });
});

describe("feedHasProblem", () => {
  it("is true for an enabled feed that is overdue or failed", () => {
    expect(feedHasProblem(feed({ stale: true }))).toBe(true);
    expect(feedHasProblem(feed({ error: "x" }))).toBe(true);
    expect(feedHasProblem(feed({ missing: 1 }))).toBe(true);
  });

  it("is false for a disabled feed, whatever its state", () => {
    expect(feedHasProblem(feed({ enabled: false, stale: true }))).toBe(false);
  });

  it("is false while a run works on the problem", () => {
    expect(feedHasProblem(feed({ stale: true, activity: "running" }))).toBe(
      false,
    );
  });

  it("is false for a feed with no data yet", () => {
    expect(feedHasProblem(feed({ last: null }))).toBe(false);
  });
});

describe("isActive", () => {
  it("is true while the process works on the feed or owes it a history", () => {
    expect(isActive(feed({ activity: "queued" }))).toBe(true);
    expect(isActive(feed({ history_pending: 2 }))).toBe(true);
    expect(isActive(feed())).toBe(false);
    expect(isActive(feed({ enabled: false, history_pending: 2 }))).toBe(false);
  });
});

describe("summarizeFeeds", () => {
  it("counts the feeds, the enabled ones and the ones with a problem", () => {
    const feeds = [
      feed(),
      feed({ stale: true }),
      feed({ enabled: false, stale: true }),
      feed({ error: "x" }),
      feed({ last: null, activity: "queued" }),
    ];

    expect(summarizeFeeds(feeds)).toEqual({
      total: 5,
      enabled: 4,
      problems: 2,
      loading: 1,
    });
  });

  it("counts an empty list as zero", () => {
    expect(summarizeFeeds([])).toEqual({
      total: 0,
      enabled: 0,
      problems: 0,
      loading: 0,
    });
  });
});
