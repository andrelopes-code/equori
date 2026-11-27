import { ExchangeRateField } from "@/features/transactions/brokerage-account/exchange-rate-field";
import { ShortfallNotice } from "@/features/transactions/brokerage-account/shortfall-notice";
import type { TradeDraft } from "@/features/transactions/trade-entry/trade-draft";
import { TradeCostFields } from "@/features/transactions/trade-entry/trade-cost-fields";
import { TradeTotalField } from "@/features/transactions/trade-entry/trade-total-field";
import type { TradeView } from "@/features/transactions/trade-entry/use-trade-entry";

interface TradeAmountFieldsProps {
  draft: TradeDraft;
  view: TradeView;
  errors: Record<string, string>;
  scale: (code: string) => number;
  onChange: (patch: Partial<TradeDraft>) => void;
}

// The total, the charges and the shortfall of a purchase or a sale; a write-off moves no money
// and draws none of them (listed options design W1).
export function TradeAmountFields({
  draft,
  view,
  errors,
  scale,
  onChange,
}: TradeAmountFieldsProps) {
  if (draft.side === "write_off") return null;

  const { cashCurrency } = view;
  const cashScale = cashCurrency === undefined ? 0 : scale(cashCurrency);

  return (
    <>
      <TradeTotalField
        draft={draft}
        view={view}
        errors={errors}
        scale={scale}
        onChange={onChange}
      />

      <ExchangeRateField
        base={view.base}
        currency={cashCurrency}
        value={draft.exchangeRate ?? null}
        error={errors.exchange_rate}
        onChange={(exchangeRate) => {
          onChange({ exchangeRate });
        }}
      />

      <TradeCostFields
        draft={draft}
        currency={cashCurrency}
        currencyScale={cashScale}
        errors={errors}
        onChange={onChange}
      />

      {view.shortfall !== null && view.payer !== undefined && (
        <ShortfallNotice
          payer={view.payer}
          amount={view.shortfall}
          scale={cashScale}
        />
      )}
    </>
  );
}
