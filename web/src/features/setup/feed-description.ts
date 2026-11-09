import type { components } from "@/api/schema.gen";
import { formatDate, numberFormatter } from "@/i18n/format";
import type { TFunction } from "@/i18n/i18n-provider";

type MarketDataFeed = components["schemas"]["MarketDataFeed"];

// ADR 025 F10 status, then plan 2 D26: coverage, pending history and the unofficial tag.
export function feedDescription(
  f: MarketDataFeed,
  t: TFunction,
  tag: string,
): string {
  const parts = [status(f, t, tag)];
  const count = (n: number) => numberFormatter(tag).format(n);
  if (f.kind === "price") {
    if (f.covers === 0) parts.push(t("settings.feeds.covers.none"));
    else if (f.covers === 1) parts.push(t("settings.feeds.covers.one"));
    else
      parts.push(t("settings.feeds.covers.other", { count: count(f.covers) }));
  }
  if (f.history_pending === 1)
    parts.push(t("settings.feeds.historyPending.one"));
  else if (f.history_pending > 1)
    parts.push(
      t("settings.feeds.historyPending.other", {
        count: count(f.history_pending),
      }),
    );
  if (!f.official) parts.push(t("settings.feeds.unofficial.tag"));

  return parts.join(" · ");
}

function status(f: MarketDataFeed, t: TFunction, tag: string): string {
  if (f.error !== null) return t("marketData.failed", { error: f.error });
  if (f.last === null) return t("marketData.never");
  const date = formatDate(f.last, tag);

  return f.stale
    ? t("marketData.stale", { date })
    : t("marketData.last", { date });
}
