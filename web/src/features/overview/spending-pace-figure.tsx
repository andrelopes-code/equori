import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { categoryTotalsQuery } from "@/features/categories";
import { FigureWidget } from "@/features/overview/figure-widget";
import { shiftMonth } from "@/features/overview/forecast";
import type { Placement } from "@/features/overview/overview-block";
import {
  paceChange,
  paceRanges,
  spendingOf,
} from "@/features/overview/spending-pace";
import { SpendingPaceHelp } from "@/features/overview/spending-pace-help";
import { useBase } from "@/features/overview/use-base";
import { formatMonthName } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { useMoneyFormat } from "@/privacy/use-money-format";

type SpendingPaceFigureProps = Placement;

// The month's spending up to today against the same days of the month before, on the basis of
// Spending by category (spending pace design).
export function SpendingPaceFigure(placement: SpendingPaceFigureProps) {
  const t = useT();
  const api = useApi();
  const fmt = useMoneyFormat();
  const [locale] = useAppLocale();
  const today = useToday();
  const { base, scale, error: baseError, retry: retryBase } = useBase();
  const { current, previous } = paceRanges(today);
  const now = useQuery(
    categoryTotalsQuery(api, current.from, current.to, "expense"),
  );
  const before = useQuery(
    categoryTotalsQuery(api, previous.from, previous.to, "expense"),
  );

  const ready =
    now.data !== undefined &&
    before.data !== undefined &&
    base !== undefined &&
    scale !== null;
  const digits = base === undefined || scale === null ? 0 : scale(base);
  const spent = ready ? spendingOf(now.data, base) : undefined;
  const spentBefore = ready ? spendingOf(before.data, base) : undefined;
  const change =
    spent === undefined || spentBefore === undefined
      ? undefined
      : paceChange(spent, spentBefore);
  const month = formatMonthName(
    shiftMonth(today.slice(0, 7), -1),
    locale,
  ).toLocaleLowerCase(locale);
  const note = noteOf(
    t,
    month,
    spentBefore === undefined || base === undefined
      ? undefined
      : {
          amount: spentBefore,
          text: fmt.money({ amount: spentBefore, currency: base }, digits),
        },
  );

  function handleRetry() {
    retryBase();
    if (now.isError) void now.refetch();
    if (before.isError) void before.refetch();
  }

  return (
    <FigureWidget
      placement={placement}
      link={{
        label: t("overview.spending.open"),
        options: { to: "/categories" },
      }}
      help={<SpendingPaceHelp />}
      error={baseError ?? now.error ?? before.error}
      onRetry={handleRetry}
      loading={!ready}
      goodWhen="down"
      value={
        spent === undefined || base === undefined
          ? undefined
          : { money: { amount: spent, currency: base }, scale: digits }
      }
      delta={change}
      note={note}
    />
  );
}

// The previous spending in words; nothing while it loads.
function noteOf(
  t: ReturnType<typeof useT>,
  month: string,
  before: { amount: number; text: string } | undefined,
): string {
  if (before === undefined) return "";

  if (before.amount <= 0) return t("overview.pace.noPrevious", { month });

  return t("overview.pace.note", { month, amount: before.text });
}
