import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@slotted/react/field";
import { Segment, SegmentedControl } from "@slotted/react/segmented-control";
import { TextField } from "@slotted/react/text-field";

import { CategoryPicker } from "@/features/categories";
import { formatRate } from "@/features/instruments";
import { BrokerageAccountFields } from "@/features/transactions/brokerage-account-fields";
import type { EntryKind } from "@/features/transactions/entry-kind";
import { EntryKindPicker } from "@/features/transactions/entry-kind-picker";
import type { TradeDraft } from "@/features/transactions/trade-draft";
import type { TradeView } from "@/features/transactions/use-trade-entry";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { MASK } from "@/privacy/mask";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { DateInput } from "@/ui/date-input";
import widths from "@/ui/field-width.module.css";
import { FigureCard } from "@/ui/figure-card";
import { FigureGrid } from "@/ui/figure-grid";
import { FormLayout } from "@/ui/form-layout";
import { FormRow } from "@/ui/form-row";
import { MoneyInput } from "@/ui/money-input";
import type { MoneyAmount } from "@/ui/money-value";

// Families read: segmented-control, field, text-field, stat-card. The side is two exclusive words
// (a segmented control); the money fields are the application's own MoneyInput (a till-style
// entry, O7); the accounts are AccountField, offered only the accounts the contract accepts.
export function TradeForm({
  draft,
  onChange,
  view,
  errors,
  scale,
  onKind,
}: {
  draft: TradeDraft;
  onChange: (draft: TradeDraft) => void;
  view: TradeView;
  errors: Record<string, string>;
  scale: (code: string) => number;
  onKind: (kind: EntryKind) => void;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  const set = (patch: Partial<TradeDraft>) => {
    onChange({ ...draft, ...patch });
  };
  const { security, base } = view;
  const instrument = security?.currency;
  const sell = draft.side === "sell";
  const baseScale = base === undefined ? 0 : scale(base);
  const figure = (amount: number, signed = false): MoneyAmount | undefined =>
    base === undefined
      ? undefined
      : { money: { amount, currency: base }, scale: baseScale, signed };
  const average = view.held?.average_cost;

  return (
    <FormLayout
      aside={
        <FigureGrid label={t("trade.cashEffect")}>
          <FigureCard
            label={t("trade.gross")}
            value={view.gross === null ? undefined : figure(view.gross)}
            note={null}
          />
          <FigureCard
            label={t("trade.cashEffect")}
            value={
              view.cashEffect === null
                ? undefined
                : figure(view.cashEffect, true)
            }
            note={null}
          />
          {sell && (
            <>
              <FigureCard
                label={t("trade.position")}
                value={
                  view.held === undefined || instrument === undefined
                    ? undefined
                    : `${fmt.plain(view.held.quantity, scale(instrument))} ${instrument}`
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
                value={
                  view.result === null ? undefined : figure(view.result, true)
                }
                note={null}
              />
            </>
          )}
        </FigureGrid>
      }
    >
      <EntryKindPicker value="trade" onChange={onKind} investments />

      <Field>
        <FieldLabel>{t("trade.side")}</FieldLabel>
        <SegmentedControl
          aria-label={t("trade.side")}
          value={draft.side}
          onValueChange={(side) => {
            if (side === "buy" || side === "sell") set({ side });
          }}
        >
          <Segment value="buy">{t("trade.side.buy")}</Segment>
          <Segment value="sell">{t("trade.side.sell")}</Segment>
        </SegmentedControl>
      </Field>

      <BrokerageAccountFields
        securities={view.securities}
        security={security}
        cashChoices={view.cashChoices}
        cashAccountId={view.cashAccountId}
        base={base}
        ready={view.ready}
        date={draft.date}
        money={sell ? "in" : "out"}
        errors={errors}
        scale={scale}
        onSecurity={(id) => {
          set({ accountId: id });
        }}
        onCash={(id) => {
          set({ cashAccountId: id });
        }}
      />

      <Field invalid={errors.date !== undefined}>
        <FieldLabel>{t("entry.date")}</FieldLabel>
        <DateInput
          name="date"
          value={draft.date}
          onChange={(date) => {
            set({ date });
          }}
        />
        {errors.date !== undefined && <FieldError>{errors.date}</FieldError>}
      </Field>

      <FormRow>
        <Field invalid={errors.quantity !== undefined}>
          <FieldLabel>{t("trade.quantity")}</FieldLabel>
          <MoneyInput
            size="field"
            className={widths.medium}
            value={draft.quantity}
            currency={instrument ?? ""}
            scale={instrument === undefined ? 0 : scale(instrument)}
            sign="neutral"
            onChange={(quantity) => {
              set({ quantity });
            }}
          />
          {errors.quantity !== undefined && (
            <FieldError>{errors.quantity}</FieldError>
          )}
        </Field>
        <Field invalid={errors.unit_price !== undefined}>
          <FieldLabel>{t("trade.unitPrice")}</FieldLabel>
          <TextField
            className={widths.medium}
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
              set({ unitPrice: event.target.value });
            }}
          />
          <FieldDescription>
            {view.storedPrice === undefined
              ? t("trade.noStoredPrice")
              : t("trade.priceStored", {
                  date: new Intl.DateTimeFormat(locale, {
                    dateStyle: "medium",
                    timeZone: "UTC",
                  }).format(new Date(`${draft.date}T00:00:00Z`)),
                  price: fmt.hidden
                    ? MASK
                    : formatRate(view.storedPrice, locale),
                })}
          </FieldDescription>
          {errors.unit_price !== undefined && (
            <FieldError>{errors.unit_price}</FieldError>
          )}
        </Field>
      </FormRow>

      <FormRow>
        <Field invalid={errors.fees !== undefined}>
          <FieldLabel>{t("trade.fees")}</FieldLabel>
          <MoneyInput
            size="field"
            className={widths.medium}
            value={draft.fees}
            currency={base ?? ""}
            scale={baseScale}
            sign="neutral"
            onChange={(fees) => {
              set({ fees });
            }}
          />
          {errors.fees !== undefined && <FieldError>{errors.fees}</FieldError>}
        </Field>
        {sell && (
          <Field invalid={errors.taxes !== undefined}>
            <FieldLabel>{t("trade.taxes")}</FieldLabel>
            <MoneyInput
              size="field"
              className={widths.medium}
              value={draft.taxes}
              currency={base ?? ""}
              scale={baseScale}
              sign="neutral"
              onChange={(taxes) => {
                set({ taxes });
              }}
            />
            {errors.taxes !== undefined && (
              <FieldError>{errors.taxes}</FieldError>
            )}
          </Field>
        )}
      </FormRow>

      {sell && draft.taxes > 0 && (
        <Field invalid={errors.taxes_category_id !== undefined}>
          <FieldLabel>{t("trade.taxesCategory")}</FieldLabel>
          <CategoryPicker
            placeholder={t("trade.taxesCategoryPlaceholder")}
            value={draft.taxesCategoryId}
            amount={-1}
            onChange={(id) => {
              set({ taxesCategoryId: id });
            }}
          />
          {errors.taxes_category_id !== undefined && (
            <FieldError>{errors.taxes_category_id}</FieldError>
          )}
        </Field>
      )}

      <Field invalid={errors.description !== undefined}>
        <FieldLabel>{t("facts.description")}</FieldLabel>
        <TextField
          name="description"
          value={draft.description}
          maxLength={500}
          onChange={(event) => {
            set({ description: event.target.value });
          }}
        />
        {errors.description !== undefined && (
          <FieldError>{errors.description}</FieldError>
        )}
      </Field>
    </FormLayout>
  );
}
