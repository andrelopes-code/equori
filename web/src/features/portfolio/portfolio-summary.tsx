import { Link } from "@slotted/react/link";

import type { components } from "@/api/schema.gen";
import type { HoldingsSummary } from "@/features/portfolio/portfolio-holdings";
import { usePortfolioIncome } from "@/features/portfolio/use-portfolio-income";
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
  base: string | undefined;
  pending: boolean;
}

// PC2: how much there is, how much it made, and what it paid.
export function PortfolioSummary({
  summary,
  date,
  valueIn,
  base,
  pending,
}: PortfolioSummaryProps) {
  const t = useT();
  const fmt = useMoneyFormat();
  const scale = useScale();
  const income = usePortfolioIncome(date);

  const { totals, year } = income;
  const write = (m: Money) => fmt.money(m, scale?.(m.currency) ?? 0);
  const inBase = (amount: number) => write({ amount, currency: valueIn ?? "" });
  const list = (amounts: readonly Money[]) => amounts.map(write).join(" · ");
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
  // PC23: with no position whose cost and value share a currency, no gain can be stated here.
  const gainElsewhere = summary.cost === 0 && summary.mixed > 0;
  const paidElsewhere = totals.net.some((m) => m.currency !== valueIn);
  const incomeNote =
    totals.net.length === 0
      ? t("holdings.income.none")
      : [
          t("holdings.income.note", { withheld: list(totals.withheld) }),
          ...(paidElsewhere ? [t("holdings.income.original")] : []),
        ].join(" · ");

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
        value={
          gainElsewhere
            ? undefined
            : fmt.signed(
                { amount: summary.gain, currency: valueIn ?? "" },
                scale?.(valueIn ?? "") ?? 0,
              )
        }
        note={
          gainElsewhere
            ? t("holdings.gain.elsewhere", { currency: base ?? "" })
            : gainNote
        }
        loading={pending}
        {...(gainElsewhere
          ? {
              action: (
                <Link
                  render={routeTo({
                    to: "/portfolio",
                    search: (previous) => ({
                      ...previous,
                      value_in: undefined,
                    }),
                  })}
                >
                  {t("holdings.missing.inBase", { base: base ?? "" })}
                </Link>
              ),
            }
          : {})}
        {...(summary.gainFraction === undefined
          ? {}
          : { delta: summary.gainFraction })}
      />
      <FigureCard
        label={t("holdings.income", { year: String(year) })}
        value={totals.net.length === 0 ? inBase(0) : list(totals.net)}
        note={incomeNote}
        goodWhen="none"
        loading={pending || income.pending}
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
