import { Button } from "@slotted/react/button";

import type { useIncomeEntry } from "@/features/transactions/income-entry/use-income-entry";
import { formatBasisPoints } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { FigureCard } from "@/ui/display/figure-card";
import { FigureGrid } from "@/ui/display/figure-grid";

interface IncomeAsideProps {
  view: ReturnType<typeof useIncomeEntry>["view"];
  cashScale: number;
  onWithheld: (withheld: number) => void;
}

// The figures of the income beside the form: the net amount and, where the region withholds tax on
// the type, the estimate. The estimate enters the form only when it is asked for (A235).
export function IncomeAside({ view, cashScale, onWithheld }: IncomeAsideProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const { cashCurrency, net, estimate } = view;

  function figure(amount: number | null) {
    return amount === null || cashCurrency === undefined
      ? undefined
      : { money: { amount, currency: cashCurrency }, scale: cashScale };
  }

  return (
    <FigureGrid label={t("income.net")}>
      <FigureCard label={t("income.net")} value={figure(net)} note={null} />

      {estimate !== null && (
        <FigureCard
          label={t("entry.estimate")}
          value={figure(estimate.withheld)}
          note={t("income.estimateNote", {
            rate: formatBasisPoints(estimate.rateBp, tag),
          })}
          action={
            <Button
              size="sm"
              variant="outline"
              tone="secondary"
              onClick={() => {
                onWithheld(estimate.withheld);
              }}
            >
              {t("trade.useEstimate")}
            </Button>
          }
        />
      )}
    </FigureGrid>
  );
}
