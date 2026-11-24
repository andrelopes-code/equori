import type { FeedSummary } from "@/features/setup/market-data/feed-status";
import type { TFunction } from "@/i18n/i18n-provider";

export interface RegionVerdict {
  text: string;
  tone: "ok" | "muted" | "warning";
}

// The verdict of a region, in words: no feed active, first loads, feeds with a problem, or up to date.
export function regionVerdict(s: FeedSummary, t: TFunction): RegionVerdict {
  if (s.enabled === 0)
    return { text: t("marketData.verdict.noneActive"), tone: "muted" };
  if (s.loading === 1)
    return { text: t("marketData.count.loading.one"), tone: "muted" };
  if (s.loading > 1)
    return {
      text: t("marketData.count.loading.other", { count: s.loading }),
      tone: "muted",
    };
  if (s.problems === 1)
    return { text: t("marketData.count.problems.one"), tone: "warning" };
  if (s.problems > 1)
    return {
      text: t("marketData.count.problems.other", { count: s.problems }),
      tone: "warning",
    };

  return { text: t("marketData.verdict.upToDate"), tone: "ok" };
}

// The count under a region's name: "8 of 8 active".
export function regionLine(s: FeedSummary, t: TFunction): string {
  return s.total === 1
    ? t("marketData.count.active.one", { enabled: s.enabled })
    : t("marketData.count.active", { enabled: s.enabled, total: s.total });
}

// The line under "Other regions": text only, so the header does not grow with the regions.
export function othersSummary(
  regions: readonly FeedSummary[],
  t: TFunction,
): string {
  const sources = regions.reduce((n, s) => n + s.total, 0);
  const enabled = regions.reduce((n, s) => n + s.enabled, 0);

  return [
    plural(regions.length, "regions", t),
    plural(sources, "sources", t),
    enabled === 0
      ? t("marketData.count.enabled.none")
      : plural(enabled, "enabled", t),
  ].join(" · ");
}

function plural(
  count: number,
  noun: "regions" | "sources" | "enabled",
  t: TFunction,
): string {
  return count === 1
    ? t(`marketData.count.${noun}.one`)
    : t(`marketData.count.${noun}.other`, { count });
}
