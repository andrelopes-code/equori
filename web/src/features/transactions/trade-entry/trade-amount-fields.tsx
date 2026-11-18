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

  const { base } = view;
  const baseScale = base === undefined ? 0 : scale(base);

  return (
    <>
      <TradeTotalField
        draft={draft}
        view={view}
        errors={errors}
        scale={scale}
        onChange={onChange}
      />

      <TradeCostFields
        draft={draft}
        base={base}
        baseScale={baseScale}
        errors={errors}
        onChange={onChange}
      />

      {view.shortfall !== null && view.payer !== undefined && (
        <ShortfallNotice
          payer={view.payer}
          amount={view.shortfall}
          scale={baseScale}
        />
      )}
    </>
  );
}
