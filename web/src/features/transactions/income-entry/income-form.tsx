import { Field, FieldError, FieldLabel } from "@slotted/react/field";
import { TextField } from "@slotted/react/text-field";
import type { ReactNode } from "react";

import { catalogLabel } from "@/features/setup";
import { BrokerageFields } from "@/features/transactions/brokerage-account/brokerage-fields";
import { ExchangeRateField } from "@/features/transactions/brokerage-account/exchange-rate-field";
import { MissingCashNotice } from "@/features/transactions/brokerage-account/missing-cash-notice";
import type { EntryKind } from "@/features/transactions/entry-model/entry-kind";
import { EntryKindPicker } from "@/features/transactions/entry-kind-picker/entry-kind-picker";
import { IncomeAmountFields } from "@/features/transactions/income-entry/income-amount-fields";
import { IncomeAside } from "@/features/transactions/income-entry/income-aside";
import { IncomeCategoryFields } from "@/features/transactions/income-entry/income-category-fields";
import type { IncomeDraft } from "@/features/transactions/income-entry/income-draft";
import type { useIncomeEntry } from "@/features/transactions/income-entry/use-income-entry";
import { useT } from "@/i18n/i18n-provider";
import { ChoiceSelect } from "@/ui/form-fields/choice-select";
import { DateInput } from "@/ui/form-fields/date-input";
import { FieldTitle } from "@/ui/form-fields/field-title";
import { FormLayout } from "@/ui/form-layout/form-layout";

// Families read: select, field, text-field, stat-card. The type is a choice from the list the API
// returns (a jurisdiction's types, never a literal); the amounts are the application's MoneyInput.
export function IncomeForm({
  draft,
  onChange,
  view,
  errors,
  scale,
  onKind,
  children,
}: {
  draft: IncomeDraft;
  onChange: (draft: IncomeDraft) => void;
  view: ReturnType<typeof useIncomeEntry>["view"];
  errors: Record<string, string>;
  scale: (code: string) => number;
  // Absent on a correction: a transaction keeps its kind (A227 IC2).
  onKind?: (kind: EntryKind) => void;
  // Fields after the description, such as the reason of a correction.
  children?: ReactNode;
}) {
  const t = useT();
  const set = (patch: Partial<IncomeDraft>) => {
    onChange({ ...draft, ...patch });
  };
  const { base } = view;
  const { cashCurrency } = view;
  const cashScale = cashCurrency === undefined ? 0 : scale(cashCurrency);

  return (
    <FormLayout
      aside={
        <IncomeAside
          view={view}
          cashScale={cashScale}
          onWithheld={(withheld) => {
            set({ withheld });
          }}
        />
      }
    >
      {onKind !== undefined && (
        <EntryKindPicker
          value="investment_income"
          onChange={onKind}
          investments
        />
      )}

      <BrokerageFields
        brokerages={view.brokerages}
        brokerage={view.brokerage}
        instrument={view.instrument}
        heldCodes={view.heldCodes}
        payers={view.payers}
        payer={view.payer}
        balance={view.balance}
        base={cashCurrency}
        date={draft.date}
        money="in"
        errors={errors}
        scale={scale}
        onBrokerage={(id) => {
          set({ brokerageId: id, instrument: null, cashAccountId: null });
        }}
        onInstrument={(code) => {
          set({ instrument: code });
        }}
        onCash={(id) => {
          set({ cashAccountId: id });
        }}
      />

      {view.brokerage !== undefined && !view.baseCash && base !== undefined && (
        <MissingCashNotice brokerage={view.brokerage} base={base} />
      )}

      <Field width="medium" required invalid={errors.income_type !== undefined}>
        <FieldTitle label={t("income.type")} help={t("income.typeHelp")} />
        <ChoiceSelect
          label={t("income.type")}
          placeholder={t("income.typePlaceholder")}
          multiple={false}
          choices={view.types.map((type) => ({
            value: type,
            label: catalogLabel(t, `income.type.${type}`, type),
          }))}
          value={draft.incomeType}
          invalid={errors.income_type !== undefined}
          onChange={(value) => {
            if (typeof value === "string") set({ incomeType: value });
          }}
        />
        {errors.income_type !== undefined && (
          <FieldError>{errors.income_type}</FieldError>
        )}
      </Field>

      <Field required invalid={errors.date !== undefined}>
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

      <ExchangeRateField
        base={base}
        currency={cashCurrency}
        value={draft.exchangeRate ?? null}
        error={errors.exchange_rate}
        onChange={(exchangeRate) => {
          set({ exchangeRate });
        }}
      />

      <IncomeAmountFields
        draft={draft}
        currency={cashCurrency}
        currencyScale={cashScale}
        taxed={view.estimate !== null}
        errors={errors}
        onChange={set}
      />

      <IncomeCategoryFields draft={draft} errors={errors} onChange={set} />

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

      {children}
    </FormLayout>
  );
}
