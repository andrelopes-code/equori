import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import {
  feedHasProblem,
  feedStatus,
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
    last_run: null,
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
  });

  it("is false for a disabled feed, whatever its state", () => {
    expect(feedHasProblem(feed({ enabled: false, stale: true }))).toBe(false);
  });

  it("is false for a feed with no data yet", () => {
    expect(feedHasProblem(feed({ last: null }))).toBe(false);
  });
});

describe("summarizeFeeds", () => {
  it("counts the feeds, the enabled ones and the ones with a problem", () => {
    const feeds = [
      feed(),
      feed({ stale: true }),
      feed({ enabled: false, stale: true }),
      feed({ error: "x" }),
    ];

    expect(summarizeFeeds(feeds)).toEqual({
      total: 4,
      enabled: 3,
      problems: 2,
    });
  });

  it("counts an empty list as zero", () => {
    expect(summarizeFeeds([])).toEqual({ total: 0, enabled: 0, problems: 0 });
  });
});
