import { Link } from "@slotted/react/link";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { incomeEventsQuery } from "@/features/portfolio/api";
import type { HoldingsSummary } from "@/features/portfolio/portfolio-holdings";
import { incomeTotals } from "@/features/portfolio/year-income";
import { useScale } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { FigureCard } from "@/ui/figure-card";
import { FigureGrid } from "@/ui/figure-grid";
import { routeTo } from "@/ui/route-to";

type Money = components["schemas"]["Money"];

interface PortfolioSummaryProps {
  summary: HoldingsSummary;
  date: string;
  valueIn: string | undefined;
  pending: boolean;
}

// PC2: how much there is, how much it made, and what it paid.
export function PortfolioSummary({
  summary,
  date,
  valueIn,
  pending,
}: PortfolioSummaryProps) {
  const t = useT();
  const api = useApi();
  const fmt = useMoneyFormat();
  const scale = useScale();
  const year = Number(date.slice(0, 4));
  const income = useQuery(incomeEventsQuery(api, year));

  const totals = incomeTotals(income.data?.items ?? [], date);
  const write = (m: Money) => fmt.money(m, scale?.(m.currency) ?? 0);
  const inBase = (amount: number) => write({ amount, currency: valueIn ?? "" });
  const list = (amounts: readonly Money[]) => amounts.map(write).join(" + ");
  const valueNote = [
    t("holdings.value.note", {
      positions: inBase(summary.positions),
      cash: inBase(summary.cash),
    }),
    ...(summary.unpriced > 0
      ? [t("holdings.value.unpriced", { count: summary.unpriced })]
      : []),
  ].join(" · ");
  const gainNote = [
    t("holdings.gain.note", { cost: inBase(summary.cost) }),
    ...(summary.mixed > 0
      ? [t("holdings.gain.mixed", { count: summary.mixed })]
      : []),
  ].join(" · ");
  const incomeNote =
    totals.net.length === 0
      ? t("holdings.income.none")
      : t("holdings.income.note", { withheld: list(totals.withheld) });

  return (
    <FigureGrid label={t("holdings.summary")}>
      <FigureCard
        label={t("holdings.value")}
        value={inBase(summary.total)}
        note={valueNote}
        goodWhen="none"
        loading={pending}
      />
      <FigureCard
        label={t("holdings.gain")}
        value={fmt.signed(
          { amount: summary.gain, currency: valueIn ?? "" },
          scale?.(valueIn ?? "") ?? 0,
        )}
        note={gainNote}
        loading={pending}
        {...(summary.gainFraction === undefined
          ? {}
          : { delta: summary.gainFraction })}
      />
      <FigureCard
        label={t("holdings.income", { year: String(year) })}
        value={totals.net.length === 0 ? inBase(0) : list(totals.net)}
        note={incomeNote}
        goodWhen="none"
        loading={pending || income.isPending}
        action={
          <Link
            render={routeTo({
              to: "/portfolio/year",
              search: { year, tab: "income" },
            })}
          >
            {t("holdings.income.open")}
          </Link>
        }
      />
    </FigureGrid>
  );
}
