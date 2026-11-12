import type { components } from "@/api/schema.gen";
import { positionTotals } from "@/features/instruments/model/position-totals";
import { usePriceFormat } from "@/features/instruments/model/use-price-format";
import { useScale } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { FigureCard } from "@/ui/display/figure-card";
import { FigureGrid } from "@/ui/display/figure-grid";

type Position = components["schemas"]["Position"];

interface PositionFiguresProps {
  rows: readonly Position[];
  quote: string;
  // CA5: the name of the only account that holds the instrument; it replaces the count in the
  // first card, because the page draws no table of one row.
  accountName?: string | undefined;
}

// IP8: what the book holds of the instrument, summed over its accounts, and the unrealized result.
export function PositionFigures({
  rows,
  quote,
  accountName,
}: PositionFiguresProps) {
  const t = useT();
  const fmt = useMoneyFormat();
  const scale = useScale();
  const price = usePriceFormat(quote);
  const totals = positionTotals(rows, quote);
  if (totals === null || scale === null) return null;

  const costScale = scale(totals.cost.currency);
  const accounts = t(
    rows.length === 1
      ? "instrument.position.accounts.one"
      : "instrument.position.accounts.other",
    { count: rows.length },
  );
  const { result, marketValue } = totals;

  return (
    <FigureGrid label={t("instrument.position.figures")}>
      <FigureCard
        label={t("positions.marketValue")}
        value={
          marketValue === null
            ? undefined
            : { money: marketValue, scale: scale(marketValue.currency) }
        }
        note={
          accountName ??
          (marketValue === null ? t("instrument.position.noPrice") : accounts)
        }
      />
      <FigureCard
        label={t("positions.costBasis")}
        value={{ money: totals.cost, scale: costScale }}
        note={
          totals.averageCost === null
            ? accounts
            : t("instrument.position.averageNote", {
                price: price.number(totals.averageCost),
              })
        }
      />
      <FigureCard
        label={t("instrument.position.result")}
        value={
          result === null
            ? undefined
            : {
                money: {
                  amount: result.amount,
                  currency: totals.cost.currency,
                },
                scale: costScale,
                signed: true,
              }
        }
        {...(result?.bp == null ? {} : { delta: result.bp / 10000 })}
        note={resultNote(
          totals.blocked,
          totals.cost.currency,
          marketValue?.currency,
        )}
      />
      <FigureCard
        label={t("positions.quantity")}
        value={fmt.number(totals.quantity, scale(totals.quantity.currency))}
        note={accounts}
      />
    </FigureGrid>
  );

  function resultNote(
    blocked: "price" | "currency" | null,
    cost: string,
    value: string | undefined,
  ) {
    if (blocked === "price") return t("instrument.position.noPrice");
    if (blocked === "currency")
      return t("instrument.position.currencyMismatch", {
        cost,
        value: value ?? "",
      });

    return t("instrument.position.resultNote");
  }
}
