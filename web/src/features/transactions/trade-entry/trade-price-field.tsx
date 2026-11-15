import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@slotted/react/field";

import { formatRate } from "@/features/instruments";
import type { TradeDraft } from "@/features/transactions/trade-entry/trade-draft";
import type { TradeView } from "@/features/transactions/trade-entry/use-trade-entry";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { MASK } from "@/privacy/mask";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { PriceInput } from "@/ui/money/price-input";

interface TradePriceFieldProps {
  draft: TradeDraft;
  view: TradeView;
  errors: Record<string, string>;
  onChange: (patch: Partial<TradeDraft>) => void;
}

// The unit price of a trade. Typing it makes it the price the order is recorded by; while the
// total was edited last it shows the price derived from the total (A228 IO1). Families read:
// field, text-field.
export function TradePriceField({
  draft,
  view,
  errors,
  onChange,
}: TradePriceFieldProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  const stored = view.storedPrice;
  const invalid =
    errors.unit_price !== undefined && draft.priceBasis === "unit";
  const day = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  }).format(new Date(`${draft.date}T00:00:00Z`));

  return (
    <Field required width="medium" invalid={invalid}>
      <FieldLabel>{t("trade.unitPrice")}</FieldLabel>
      <PriceInput
        name="unit_price"
        value={view.price}
        currency={view.base ?? ""}
        invalid={invalid}
        onChange={(unitPrice) => {
          onChange({ unitPrice, priceBasis: "unit" });
        }}
      />
      <FieldDescription>
        {stored === undefined
          ? t("trade.noStoredPrice")
          : t("trade.priceStored", {
              date: day,
              price: fmt.hidden ? MASK : formatRate(stored, locale),
            })}
      </FieldDescription>
      {invalid && <FieldError>{errors.unit_price}</FieldError>}
    </Field>
  );
}
