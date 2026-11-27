import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@slotted/react/field";

import type { TradeDraft } from "@/features/transactions/trade-entry/trade-draft";
import type { TradeView } from "@/features/transactions/trade-entry/use-trade-entry";
import { useT } from "@/i18n/i18n-provider";
import { FormRow } from "@/ui/form-layout/form-row";
import { MoneyInput } from "@/ui/money/money-input";

interface TradeTotalFieldProps {
  draft: TradeDraft;
  view: TradeView;
  errors: Record<string, string>;
  scale: (code: string) => number;
  onChange: (patch: Partial<TradeDraft>) => void;
}

// The total of an order filled at several prices (A228 IO1). Typing it makes it the amount the
// order is recorded by. While the unit price leads, the field is empty: its digits enter at the
// right, so typed digits would join a gross shown there; the aside shows that gross.
export function TradeTotalField({
  draft,
  view,
  errors,
  scale,
  onChange,
}: TradeTotalFieldProps) {
  const t = useT();
  const byTotal = draft.priceBasis === "total";
  const invalid = errors.unit_price !== undefined && byTotal;

  return (
    <FormRow>
      <Field width="medium" invalid={invalid}>
        <FieldLabel>{t("trade.total")}</FieldLabel>
        <MoneyInput
          size="field"
          value={byTotal ? draft.total : 0}
          currency={view.cashCurrency ?? ""}
          scale={view.cashCurrency === undefined ? 0 : scale(view.cashCurrency)}
          sign="neutral"
          onChange={(total) => {
            onChange({ total, priceBasis: "total" });
          }}
        />
        <FieldDescription>{t("trade.totalHelp")}</FieldDescription>
        {invalid && <FieldError>{errors.unit_price}</FieldError>}
      </Field>
    </FormRow>
  );
}
