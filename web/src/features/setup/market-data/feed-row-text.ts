import type { components } from "@/api/schema.gen";
import { numberFormatter } from "@/i18n/format";
import type { TFunction } from "@/i18n/i18n-provider";

type Feed = components["schemas"]["MarketDataFeed"];

export interface FeedRowText {
  detail: string;
  issue: { tone: "danger" | "muted"; text: string } | null;
}

// The words under a feed's name: its kind and coverage, and the failure or the pending history
// when there is one (ADR 025 F10; plan 2 D26).
export function feedRowText(f: Feed, t: TFunction, tag: string): FeedRowText {
  const count = (n: number) => numberFormatter(tag).format(n);
  const detail = [t(`marketData.kind.${f.kind}`)];
  if (f.kind === "price") detail.push(coverage(f.covers, t, count));

  return { detail: detail.join(" · "), issue: issue(f, t, count) };
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
  if (f.history_pending === 1)
    return { tone: "muted", text: t("settings.feeds.historyPending.one") };
  if (f.history_pending > 1)
    return {
      tone: "muted",
      text: t("settings.feeds.historyPending.other", {
        count: count(f.history_pending),
      }),
    };

  return null;
}
