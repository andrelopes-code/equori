import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { netWorthQuery } from "@/features/overview/api";
import { FigureWidget } from "@/features/overview/figure-widget";
import { monthEnd, shiftMonth } from "@/features/overview/forecast";
import { changeOf } from "@/features/overview/net-worth";
import type { Placement } from "@/features/overview/overview-block";
import { useBase } from "@/features/overview/use-base";
import { formatDayMonth } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { useMoneyFormat } from "@/privacy/use-money-format";

export type NetWorthKind = "assets" | "liabilities" | "net";

// Assets, liabilities or net, against the end of the month before. The link goes to the net
// worth report.
export function NetWorthFigure({
  month,
  kind,
  ...placement
}: { month: string; kind: NetWorthKind } & Placement) {
  const t = useT();
  const api = useApi();
  const fmt = useMoneyFormat();
  const [locale] = useAppLocale();
  const today = useToday();
  const { base, scale, error: baseError, retry: retryBase } = useBase();
  const previousDate = monthEnd(shiftMonth(month, -1));
  const enabled = base !== undefined;
  const current = useQuery({
    ...netWorthQuery(api, today, base ?? ""),
    enabled,
  });
  const previous = useQuery({
    ...netWorthQuery(api, previousDate, base ?? ""),
    enabled,
  });
  const now = current.data;
  const before = previous.data;
  const digits = base === undefined || scale === null ? 0 : scale(base);
  const change =
    now === undefined || before === undefined
      ? undefined
      : changeOf(now[kind].amount, before[kind].amount);
  return (
    <FigureWidget
      placement={placement}
      link={{
        label: t("overview.netWorth.open"),
        options: { to: "/reports" },
      }}
      error={baseError ?? current.error ?? previous.error}
      onRetry={() => {
        retryBase();
        if (current.isError) void current.refetch();
        if (previous.isError) void previous.refetch();
      }}
      loading={now === undefined || before === undefined}
      value={
        now === undefined || base === undefined
          ? undefined
          : fmt.money({ amount: now[kind].amount, currency: base }, digits)
      }
      delta={change?.fraction}
      goodWhen={kind === "liabilities" ? "down" : "up"}
      note={
        change === undefined || base === undefined
          ? ""
          : t("overview.netWorth.since", {
              change: fmt.signed(
                { amount: change.amount, currency: base },
                digits,
              ),
              date: formatDayMonth(previousDate, locale),
            })
      }
    />
  );
}
