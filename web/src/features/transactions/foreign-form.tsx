import { Alert, AlertContent, AlertDescription } from "@slotted/react/alert";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@slotted/react/field";
import { Text } from "@slotted/react/typography";
import { TextField } from "@slotted/react/text-field";

import type { components } from "@/api/schema.gen";
import { CategoryPicker } from "@/features/categories";
import { sourceLabel, formatRate } from "@/features/instruments";
import { AccountField } from "@/features/transactions/account-field";
import type { EntryKind } from "@/features/transactions/entry-kind";
import { EntryKindPicker } from "@/features/transactions/entry-kind-picker";
import { EntryResult } from "@/features/transactions/entry-result";
import type { ForeignDraft } from "@/features/transactions/foreign-draft";
import { PayeeField } from "@/features/transactions/payee-field";
import type { useForeignEntry } from "@/features/transactions/use-foreign-entry";
import { formatDate, formatMonthTitle } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { ChoiceSelect } from "@/ui/choice-select";
import { DateInput } from "@/ui/date-input";
import widths from "@/ui/field-width.module.css";
import { FormLayout } from "@/ui/form-layout";
import { FormRow } from "@/ui/form-row";
import { MoneyInput } from "@/ui/money-input";

type Payee = components["schemas"]["Payee"];

// Families read: select, field, text-field, date-picker, stat-card. The card, the amounts and the
// category are the application's own controls; the currency is a choice from the list of the
// user's instruments, with a code typed by hand for one the list lacks.
export function ForeignForm({
  draft,
  onChange,
  view,
  errors,
  scale,
  payees,
  onKind,
}: {
  draft: ForeignDraft;
  onChange: (draft: ForeignDraft) => void;
  view: ReturnType<typeof useForeignEntry>["view"];
  errors: Record<string, string>;
  scale: (code: string) => number;
  payees: readonly Payee[];
  onKind: (kind: EntryKind) => void;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  const set = (patch: Partial<ForeignDraft>) => {
    onChange({ ...draft, ...patch });
  };
  const { base, currency } = view;
  const chosen = view.statements.find((s) => s.reference === draft.statement);
  const placement = chosen ?? view.placement;
  const money = (amount: number | null) =>
    amount === null || base === undefined
      ? undefined
      : fmt.money({ amount, currency: base }, view.baseScale);

  return (
    <FormLayout
      aside={
        <EntryResult
          label={t("foreignPurchase.result")}
          figures={[
            {
              label: t("foreignPurchase.converted"),
              value: money(view.converted),
            },
            { label: t("foreignPurchase.charge"), value: money(view.charge) },
            { label: t("foreignPurchase.total"), value: money(view.total) },
          ]}
        />
      }
    >
      <EntryKindPicker value="foreign_purchase" onChange={onKind} investments />

      {view.ready && view.cards.length === 0 && (
        <Alert tone="info">
          <AlertContent>
            <AlertDescription>
              {t("foreignPurchase.noCard", { currency: base ?? "" })}
            </AlertDescription>
          </AlertContent>
        </Alert>
      )}
      <Field invalid={errors.account_id !== undefined}>
        <FieldLabel>{t("foreignPurchase.card")}</FieldLabel>
        <AccountField
          compact
          name="card"
          title={t("foreignPurchase.card")}
          context={t("foreignPurchase.cardContext", { currency: base ?? "" })}
          accounts={view.cards}
          value={view.card?.id ?? null}
          exclude={null}
          amount={0}
          direction="out"
          date={draft.date}
          categoryId={null}
          payeeId={null}
          kind="expense"
          currency={base ?? ""}
          scale={scale}
          onChange={(id) => {
            set({ cardId: id, chargeBP: null, statement: null });
          }}
        />
        {errors.account_id !== undefined && (
          <FieldError>{errors.account_id}</FieldError>
        )}
      </Field>

      <Field invalid={errors.date !== undefined}>
        <FieldLabel>{t("entry.date")}</FieldLabel>
        <DateInput
          name="date"
          value={draft.date}
          onChange={(date) => {
            set({ date, rate: null, statement: null });
          }}
        />
        {errors.date !== undefined && <FieldError>{errors.date}</FieldError>}
      </Field>

      <FormRow>
        <Field invalid={errors.original !== undefined}>
          <FieldLabel>{t("foreignPurchase.original")}</FieldLabel>
          <MoneyInput
            size="field"
            className={widths.medium}
            value={draft.original}
            currency={currency ?? ""}
            scale={view.originalScale}
            sign="expense"
            onChange={(original) => {
              set({ original });
            }}
          />
          {errors.original !== undefined && (
            <FieldError>{errors.original}</FieldError>
          )}
        </Field>
        <Field invalid={view.otherInvalid}>
          <FieldLabel>{t("foreignPurchase.currency")}</FieldLabel>
          <ChoiceSelect
            label={t("foreignPurchase.currency")}
            placeholder={t("foreignPurchase.currencyPlaceholder")}
            multiple={false}
            choices={view.currencies.map((code) => ({
              value: code,
              label: code,
            }))}
            value={draft.currency}
            onChange={(value) => {
              if (typeof value === "string")
                set({ currency: value, otherCurrency: "", rate: null });
            }}
          />
        </Field>
      </FormRow>

      <Field invalid={view.otherInvalid}>
        <FieldLabel>{t("foreignPurchase.otherCurrency")}</FieldLabel>
        <TextField
          className={widths.short}
          name="other-currency"
          value={draft.otherCurrency}
          maxLength={3}
          onChange={(event) => {
            set({
              otherCurrency: event.target.value.toUpperCase(),
              rate: null,
            });
          }}
        />
        {view.otherInvalid && (
          <FieldError>{t("foreignPurchase.otherCurrencyInvalid")}</FieldError>
        )}
      </Field>

      <Field invalid={errors.rate !== undefined}>
        <FieldLabel>{t("foreignPurchase.rate")}</FieldLabel>
        <TextField
          className={widths.medium}
          name="rate"
          inputMode="decimal"
          value={view.rateText}
          onChange={(event) => {
            set({ rate: event.target.value });
          }}
        />
        {currency !== null && (
          <FieldDescription>
            {view.stored === undefined
              ? view.priceLoading
                ? ""
                : t("foreignPurchase.rateMissing", {
                    currency,
                    date: formatDate(draft.date, locale),
                  })
              : t("foreignPurchase.rateSuggested", {
                  rate: formatRate(view.stored.value, locale),
                  date: formatDate(view.stored.date, locale),
                  source: sourceLabel(t, view.stored.source),
                })}
          </FieldDescription>
        )}
        {errors.rate !== undefined && <FieldError>{errors.rate}</FieldError>}
      </Field>

      <Field invalid={errors.category_id !== undefined}>
        <FieldLabel>{t("foreignPurchase.category")}</FieldLabel>
        <CategoryPicker
          placeholder={t("entry.categoryPlaceholder")}
          value={draft.categoryId}
          amount={-1}
          onChange={(id) => {
            set({ categoryId: id });
          }}
        />
        {errors.category_id !== undefined && (
          <FieldError>{errors.category_id}</FieldError>
        )}
      </Field>

      <Field invalid={errors.foreign_charge_rate_bp !== undefined}>
        <FieldLabel>{t("foreignPurchase.chargeRate")}</FieldLabel>
        <TextField
          className={widths.short}
          name="charge-rate"
          inputMode="numeric"
          value={view.chargeText}
          onChange={(event) => {
            set({ chargeBP: event.target.value });
          }}
        />
        {errors.foreign_charge_rate_bp !== undefined && (
          <FieldError>{errors.foreign_charge_rate_bp}</FieldError>
        )}
      </Field>

      {(view.chargeBP ?? 0) > 0 && (
        <Field invalid={errors.foreign_charge_category_id !== undefined}>
          <FieldLabel>{t("foreignPurchase.chargeCategory")}</FieldLabel>
          <CategoryPicker
            placeholder={t("foreignPurchase.chargeCategoryPlaceholder")}
            value={draft.chargeCategoryId}
            amount={-1}
            onChange={(id) => {
              set({ chargeCategoryId: id });
            }}
          />
          {errors.foreign_charge_category_id !== undefined && (
            <FieldError>{errors.foreign_charge_category_id}</FieldError>
          )}
        </Field>
      )}

      <Field invalid={errors.payee_id !== undefined}>
        <FieldLabel>{t("facts.payee")}</FieldLabel>
        <PayeeField
          placeholder={t("entry.payeePlaceholder")}
          payees={payees}
          value={draft.payeeId}
          onChange={(id) => {
            set({ payeeId: id });
          }}
        />
      </Field>

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
      </Field>

      <Field invalid={errors.statement !== undefined}>
        <FieldLabel>{t("foreignPurchase.statement")}</FieldLabel>
        <ChoiceSelect
          label={t("foreignPurchase.statement")}
          multiple={false}
          choices={[
            { value: "", label: t("foreignPurchase.statementAutomatic") },
            ...view.statements.map((s) => ({
              value: s.reference,
              label: formatMonthTitle(s.reference, locale),
            })),
          ]}
          value={draft.statement ?? ""}
          onChange={(value) => {
            if (typeof value === "string")
              set({ statement: value === "" ? null : value });
          }}
        />
        <Text size="sm" role="status">
          {placement !== undefined && placement !== null
            ? t("card.placement", {
                month: formatMonthTitle(placement.reference, locale),
                closing: formatDate(placement.closing_date, locale),
                due: formatDate(placement.due_date, locale),
              })
            : view.card !== undefined && view.placement === null
              ? t("card.placementNoRule")
              : ""}
        </Text>
        {errors.statement !== undefined && (
          <FieldError>{errors.statement}</FieldError>
        )}
      </Field>
    </FormLayout>
  );
}
