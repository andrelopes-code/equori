import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { monthEnd, shiftMonth } from "@/features/overview/forecast";
import { netWorthQuery } from "@/features/overview/api";
import { changeOf } from "@/features/overview/net-worth";
import { OverviewBlock } from "@/features/overview/overview-block";
import { useBase } from "@/features/overview/use-base";
import { formatDayMonth } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { FigureCard } from "@/ui/figure-card";
import { FigureGrid } from "@/ui/figure-grid";

// Assets, liabilities and net, each against the end of the month before. The link goes to the
// net worth report.
export function NetWorthBlock({
  month,
  onHide,
}: {
  month: string;
  onHide?: (() => void) | undefined;
}) {
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
  const error = baseError ?? current.error ?? previous.error;
  const now = current.data;
  const before = previous.data;
  const digits = base === undefined || scale === null ? 0 : scale(base);
  const figure = (
    key: "assets" | "liabilities" | "net",
    label: string,
    goodWhen: "up" | "down",
  ) => {
    const change =
      now === undefined || before === undefined
        ? undefined
        : changeOf(now[key].amount, before[key].amount);
    return (
      <FigureCard
        key={key}
        label={label}
        loading={now === undefined || before === undefined}
        value={
          now === undefined || base === undefined
            ? undefined
            : fmt.money({ amount: now[key].amount, currency: base }, digits)
        }
        delta={change?.fraction}
        goodWhen={goodWhen}
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
  };
  return (
    <OverviewBlock
      onHide={onHide}
      title={t("overview.netWorth.title")}
      link={{
        label: t("overview.netWorth.open"),
        options: { to: "/reports" },
      }}
      loading={false}
      error={error}
      onRetry={() => {
        retryBase();
        if (current.isError) void current.refetch();
        if (previous.isError) void previous.refetch();
      }}
    >
      <FigureGrid label={t("overview.netWorth.figures")}>
        {figure("assets", t("overview.netWorth.assets"), "up")}
        {figure("liabilities", t("overview.netWorth.liabilities"), "down")}
        {figure("net", t("overview.netWorth.net"), "up")}
      </FigureGrid>
    </OverviewBlock>
  );
}
