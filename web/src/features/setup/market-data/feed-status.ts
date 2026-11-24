import type { components } from "@/api/schema.gen";

type Feed = components["schemas"]["MarketDataFeed"];

export interface FeedStatus {
  word:
    "upToDate" | "overdue" | "incomplete" | "failed" | "noData" | "disabled";
  tone: "ok" | "warning" | "danger" | "muted";
}

export interface FeedSummary {
  total: number;
  enabled: number;
  problems: number;
}

// ADR 025 F9: only an enabled feed is overdue or failed. A disabled feed reads as disabled.
export function feedStatus(f: Feed): FeedStatus {
  if (!f.enabled) return { word: "disabled", tone: "muted" };
  if (f.error !== null) return { word: "failed", tone: "danger" };
  if (f.last === null) return { word: "noData", tone: "muted" };
  if (f.stale) return { word: "overdue", tone: "warning" };
  if (f.missing > 0) return { word: "incomplete", tone: "warning" };

  return { word: "upToDate", tone: "ok" };
}

export function feedHasProblem(f: Feed): boolean {
  return f.enabled && (f.stale || f.error !== null || f.missing > 0);
}

export function summarizeFeeds(feeds: readonly Feed[]): FeedSummary {
  return {
    total: feeds.length,
    enabled: feeds.filter((f) => f.enabled).length,
    problems: feeds.filter(feedHasProblem).length,
  };
}
