import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@slotted/react/field";
import { Inline } from "@slotted/react/inline";
import { Segment, SegmentedControl } from "@slotted/react/segmented-control";
import { TextField } from "@slotted/react/text-field";

import { formatRate } from "@/features/instruments";
import type { TradeDraft } from "@/features/transactions/trade-entry/trade-draft";
import type { TradeView } from "@/features/transactions/trade-entry/use-trade-entry";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { MASK } from "@/privacy/mask";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { FormRow } from "@/ui/form-layout/form-row";
import { MoneyInput } from "@/ui/money/money-input";

interface TradePriceFieldProps {
  draft: TradeDraft;
  view: TradeView;
  errors: Record<string, string>;
  scale: (code: string) => number;
  onChange: (patch: Partial<TradeDraft>) => void;
}

// The price of a trade, given per unit or as the total of the order: an order filled at several
// prices has no single unit price to type (A228 IO1). Families read: segmented-control, field,
// text-field.
export function TradePriceField({
  draft,
  view,
  errors,
  scale,
  onChange,
}: TradePriceFieldProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  const total = draft.priceBasis === "total";
  const storedDate = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(`${draft.date}T00:00:00Z`));

  return (
    <FormRow>
      <Field width="medium">
        <FieldLabel>{t("trade.priceBasis")}</FieldLabel>
        <Inline>
          <SegmentedControl
            aria-label={t("trade.priceBasis")}
            value={draft.priceBasis}
            onValueChange={(priceBasis) => {
              if (priceBasis === "unit" || priceBasis === "total")
                onChange({ priceBasis });
            }}
          >
            <Segment value="unit">{t("trade.priceBasis.unit")}</Segment>
            <Segment value="total">{t("trade.priceBasis.total")}</Segment>
          </SegmentedControl>
        </Inline>
      </Field>

      {!total && (
        <Field
          required
          width="medium"
          invalid={errors.unit_price !== undefined}
        >
          <FieldLabel>{t("trade.unitPrice")}</FieldLabel>
          <TextField
            name="unit_price"
            inputMode="decimal"
            autoComplete="off"
            value={
              draft.unitPrice ??
              (view.storedPrice === undefined
                ? ""
                : formatRate(view.storedPrice, locale))
            }
            onChange={(event) => {
              onChange({ unitPrice: event.target.value });
            }}
          />
          <FieldDescription>
            {view.storedPrice === undefined
              ? t("trade.noStoredPrice")
              : t("trade.priceStored", {
                  date: storedDate,
                  price: fmt.hidden
                    ? MASK
                    : formatRate(view.storedPrice, locale),
                })}
          </FieldDescription>
          {errors.unit_price !== undefined && (
            <FieldError>{errors.unit_price}</FieldError>
          )}
        </Field>
      )}

      {total && (
        <Field
          required
          width="medium"
          invalid={errors.unit_price !== undefined}
        >
          <FieldLabel>{t("trade.total")}</FieldLabel>
          <MoneyInput
            size="field"
            value={draft.total}
            currency={view.base ?? ""}
            scale={view.base === undefined ? 0 : scale(view.base)}
            sign="neutral"
            onChange={(amount) => {
              onChange({ total: amount });
            }}
          />
          <FieldDescription>{t("trade.totalHelp")}</FieldDescription>
          {errors.unit_price !== undefined && (
            <FieldError>{errors.unit_price}</FieldError>
          )}
        </Field>
      )}
    </FormRow>
  );
}
