import { Button } from "@slotted/react/button";

import { formatRate } from "@/features/instruments";
import type { TradeView } from "@/features/transactions/trade-entry/use-trade-entry";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { MASK } from "@/privacy/mask";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { FigureCard } from "@/ui/display/figure-card";
import { FigureGrid } from "@/ui/display/figure-grid";
import type { MoneyAmount } from "@/ui/money/money-value";

interface TradeAsideProps {
  view: TradeView;
  sell: boolean;
  // An opening states the cost of the position in place of a cash effect.
  opening: boolean;
  fees: number;
  scale: (code: string) => number;
  onUseEstimate: () => void;
}

// The figures of the trade beside the form: gross, cash effect and, for a sale, the position.
export function TradeAside({
  view,
  sell,
  opening,
  fees,
  scale,
  onUseEstimate,
}: TradeAsideProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  const { base, cashCurrency, instrument } = view;
  const figure = (amount: number, signed = false): MoneyAmount | undefined =>
    cashCurrency === undefined
      ? undefined
      : {
          money: { amount, currency: cashCurrency },
          scale: scale(cashCurrency),
          signed,
        };
  const average = view.held?.average_cost;

  return (
    <FigureGrid label={t("trade.cashEffect")}>
      <FigureCard
        label={t("trade.gross")}
        value={view.gross === null ? undefined : figure(view.gross)}
        note={null}
      />
      {opening ? (
        <FigureCard
          label={t("trade.opening.cost")}
          value={view.gross === null ? undefined : figure(view.gross + fees)}
          note={null}
        />
      ) : (
        <FigureCard
          label={view.foreign ? t("trade.cashMoves") : t("trade.cashEffect")}
          value={
            view.cashEffect === null ? undefined : figure(view.cashEffect, true)
          }
          note={null}
        />
      )}
      {view.foreign && base !== undefined && (
        <FigureCard
          label={t("trade.baseAmount", { base })}
          value={
            view.baseAmount === null
              ? undefined
              : {
                  money: { amount: view.baseAmount, currency: base },
                  scale: scale(base),
                  signed: !opening,
                }
          }
          note={view.exchangeRate === null ? t("trade.rateOfDay") : null}
        />
      )}
      {sell && (
        <>
          <FigureCard
            label={t("trade.position")}
            value={
              view.held === undefined || instrument === null
                ? undefined
                : `${fmt.number(view.held.quantity, scale(instrument))} ${instrument}`
            }
            note={view.held === undefined ? t("trade.noPosition") : null}
          />
          <FigureCard
            label={t("trade.averageCost")}
            value={
              average === undefined
                ? undefined
                : fmt.hidden
                  ? MASK
                  : formatRate(average, locale)
            }
            note={null}
          />
          <FigureCard
            label={t("trade.estimatedResult")}
            value={view.result === null ? undefined : figure(view.result, true)}
            note={null}
          />
          {view.withheld !== null && (
            <FigureCard
              label={t("entry.estimate")}
              value={figure(view.withheld)}
              note={t("trade.estimatedTax")}
              action={
                <Button
                  size="sm"
                  variant="outline"
                  tone="secondary"
                  onClick={onUseEstimate}
                >
                  {t("trade.useEstimate")}
                </Button>
              }
            />
          )}
        </>
      )}
    </FigureGrid>
  );
}
