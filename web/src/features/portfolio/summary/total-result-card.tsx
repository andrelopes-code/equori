import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { positionResultsQuery } from "@/features/accounts";
import type { HoldingsSummary } from "@/features/portfolio/model/portfolio-holdings";
import { totalFigure } from "@/features/portfolio/model/total-result";
import { InBaseLink } from "@/features/portfolio/summary/in-base-link";
import { totalNote } from "@/features/portfolio/summary/total-note";
import { useScale } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { FigureCard } from "@/ui/display/figure-card";

interface TotalResultCardProps {
  summary: HoldingsSummary;
  date: string;
  valueIn: string | undefined;
  base: string | undefined;
  pending: boolean;
}

const none = { realized: [], income: [] };

// A262 TR4: the gain of the positions held plus every sale and income since the first purchase.
export function TotalResultCard({
  summary,
  date,
  valueIn,
  base,
  pending,
}: TotalResultCardProps) {
  const t = useT();
  const api = useApi();
  const fmt = useMoneyFormat();
  const scale = useScale();
  const results = useQuery({
    ...positionResultsQuery(api, date, valueIn),
    enabled: valueIn !== undefined,
  });

  const currency = valueIn ?? "";
  const signed = (amount: number) =>
    fmt.signed({ amount, currency }, scale?.(currency) ?? 0);
  const figure = totalFigure(summary.gain, results.data ?? none, currency);
  // PC23: with no position whose cost and value share a currency, no total can be stated here.
  const elsewhere = summary.cost === 0 && summary.mixed > 0;
  const note = totalNote(t, figure, {
    signed,
    money: (m) => fmt.money(m, scale?.(m.currency) ?? 0),
  });

  if (elsewhere)
    return (
      <FigureCard
        label={t("holdings.total")}
        value={undefined}
        note={t("holdings.gain.elsewhere", { currency: base ?? "" })}
        loading={pending}
        action={<InBaseLink base={base} />}
      />
    );

  return (
    <FigureCard
      label={t("holdings.total")}
      value={signed(figure.value)}
      note={note}
      loading={pending || results.isPending}
    />
  );
}
