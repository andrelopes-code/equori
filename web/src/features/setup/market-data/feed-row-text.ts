import type { components } from "@/api/schema.gen";
import { feedSource } from "@/features/setup/market-data/feed-names";
import { numberFormatter } from "@/i18n/format";
import type { TFunction } from "@/i18n/i18n-provider";

type Feed = components["schemas"]["MarketDataFeed"];

export interface FeedRowText {
  // "B3 · Price": who publishes the feed and what it quotes.
  detail: string;
  // "Covers 28 instruments", for a price feed only.
  coverage: string | null;
  issue: { tone: "danger" | "warning" | "muted"; text: string } | null;
}

// The words under a feed's name: its kind and coverage, and the failure, the pending history of a
// price feed or the missing values when there is one. The word of an index that loads says it already (ADR 025 F10; plan 2 D26).
export function feedRowText(f: Feed, t: TFunction, tag: string): FeedRowText {
  const count = (n: number) => numberFormatter(tag).format(n);
  const detail = [feedSource(t, f.id), t(`marketData.kind.${f.kind}`)].filter(
    (part) => part !== "",
  );

  if (f.current) detail.push(t("settings.feeds.current"));

  return {
    detail: detail.join(" · "),
    coverage: f.kind === "price" ? coverage(f.covers, t, count) : null,
    issue: issue(f, t, count),
  };
}

function coverage(
  covers: number,
  t: TFunction,
  count: (n: number) => string,
): string {
  if (covers === 0) return t("settings.feeds.covers.none");
  if (covers === 1) return t("settings.feeds.covers.one");

  return t("settings.feeds.covers.other", { count: count(covers) });
}

function issue(
  f: Feed,
  t: TFunction,
  count: (n: number) => string,
): FeedRowText["issue"] {
  if (f.error !== null)
    return { tone: "danger", text: t("marketData.failed", { error: f.error }) };
  if (f.current_error !== null)
    return {
      tone: "danger",
      text: t("settings.feeds.currentFailed", { error: f.current_error }),
    };
  if (f.history_pending === 1 && f.kind === "price")
    return { tone: "muted", text: t("settings.feeds.historyPending.one") };
  if (f.history_pending > 1 && f.kind === "price")
    return {
      tone: "muted",
      text: t("settings.feeds.historyPending.other", {
        count: count(f.history_pending),
      }),
    };
  if (f.missing === 1)
    return { tone: "warning", text: t("settings.feeds.missing.one") };
  if (f.missing > 1)
    return {
      tone: "warning",
      text: t("settings.feeds.missing.other", { count: count(f.missing) }),
    };

  return null;
}
