import type { Holding } from "@/features/portfolio/model/portfolio-holdings";
import { formatTime, numberFormatter } from "@/i18n/format";
import type { TFunction } from "@/i18n/i18n-provider";

export interface CurrentQuote {
  at: string;
  open: boolean;
}

// The current quote of a value: the earliest instant among its prices, open when any is open.
export function currentQuoteOf(
  prices: readonly { at?: string; open?: boolean }[] | undefined,
): CurrentQuote | undefined {
  const quoted = prices?.filter((p) => p.at !== undefined) ?? [];
  const at = quoted
    .flatMap((p) => (p.at === undefined ? [] : [p.at]))
    .sort()[0];
  if (at === undefined) return undefined;

  return { at, open: quoted.some((p) => p.open === true) };
}

export interface CurrentQuotesSummary {
  current: number;
  close: number;
  oldestAt: string;
  open: boolean;
}

// How many valued holdings took a current quote and how many a close; undefined when none took one.
export function currentQuotesSummary(
  holdings: readonly Holding[],
): CurrentQuotesSummary | undefined {
  const quotes = holdings
    .filter((h) => h.value !== undefined)
    .map((h) => currentQuoteOf(h.position?.prices));
  const current = quotes.flatMap((q) => (q === undefined ? [] : [q]));
  const oldestAt = current.map((q) => q.at).sort()[0];
  if (oldestAt === undefined) return undefined;

  return {
    current: current.length,
    close: quotes.length - current.length,
    oldestAt,
    open: current.some((q) => q.open),
  };
}

// The summary as one line of text.
export function currentQuotesText(
  summary: CurrentQuotesSummary,
  t: TFunction,
  tag: string,
  timeZone?: string,
): string {
  const count = numberFormatter(tag);
  const time = formatTime(summary.oldestAt, tag, timeZone);
  const parts = [
    summary.current === 1
      ? t("holdings.quotes.current.one", { time })
      : t("holdings.quotes.current.other", {
          count: count.format(summary.current),
          time,
        }),
  ];
  if (summary.close === 1) parts.push(t("holdings.quotes.close.one"));
  if (summary.close > 1) {
    parts.push(
      t("holdings.quotes.close.other", { count: count.format(summary.close) }),
    );
  }
  if (summary.open) parts.push(t("holdings.quotes.open"));

  return parts.join(" · ");
}
