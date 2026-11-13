import { Field, FieldError, FieldLabel } from "@slotted/react/field";
import { TextField } from "@slotted/react/text-field";
import type { ReactNode } from "react";

import { CategoryPicker } from "@/features/categories";
import { catalogLabel } from "@/features/setup";
import { BrokerageFields } from "@/features/transactions/brokerage-account/brokerage-fields";
import { MissingCashNotice } from "@/features/transactions/brokerage-account/missing-cash-notice";
import type { EntryKind } from "@/features/transactions/entry-model/entry-kind";
import { EntryKindPicker } from "@/features/transactions/entry-kind-picker/entry-kind-picker";
import type { IncomeDraft } from "@/features/transactions/income-entry/income-draft";
import type { useIncomeEntry } from "@/features/transactions/income-entry/use-income-entry";
import { useT } from "@/i18n/i18n-provider";
import { ChoiceSelect } from "@/ui/form-fields/choice-select";
import { DateInput } from "@/ui/form-fields/date-input";
import { FieldTitle } from "@/ui/form-fields/field-title";
import { FigureCard } from "@/ui/display/figure-card";
import { FigureGrid } from "@/ui/display/figure-grid";
import { FormLayout } from "@/ui/form-layout/form-layout";
import { FormRow } from "@/ui/form-layout/form-row";
import { MoneyInput } from "@/ui/money/money-input";

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
  const baseScale = base === undefined ? 0 : scale(base);

  return (
    <FormLayout
      aside={
        <FigureGrid label={t("income.net")}>
          <FigureCard
            label={t("income.net")}
            value={
              view.net === null || base === undefined
                ? undefined
                : {
                    money: { amount: view.net, currency: base },
                    scale: baseScale,
                  }
            }
            note={null}
          />
        </FigureGrid>
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
        base={base}
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

      <FormRow>
        <Field required width="medium" invalid={errors.gross !== undefined}>
          <FieldTitle label={t("income.gross")} help={t("income.grossHelp")} />
          <MoneyInput
            size="field"
            value={draft.gross}
            currency={base ?? ""}
            scale={baseScale}
            sign="income"
            onChange={(gross) => {
              set({ gross });
            }}
          />
          {errors.gross !== undefined && (
            <FieldError>{errors.gross}</FieldError>
          )}
        </Field>
        <Field width="medium" invalid={errors.withheld !== undefined}>
          <FieldTitle
            label={t("income.withheld")}
            help={t("income.withheldHelp")}
          />
          <MoneyInput
            size="field"
            value={draft.withheld}
            currency={base ?? ""}
            scale={baseScale}
            sign="neutral"
            onChange={(withheld) => {
              set({ withheld });
            }}
          />
          {errors.withheld !== undefined && (
            <FieldError>{errors.withheld}</FieldError>
          )}
        </Field>
      </FormRow>

      <Field required invalid={errors.category_id !== undefined}>
        <FieldLabel>{t("income.category")}</FieldLabel>
        <CategoryPicker
          placeholder={t("entry.categoryPlaceholder")}
          value={draft.categoryId}
          amount={1}
          onChange={(id) => {
            set({ categoryId: id });
          }}
        />
        {errors.category_id !== undefined && (
          <FieldError>{errors.category_id}</FieldError>
        )}
      </Field>

      {draft.withheld > 0 && (
        <Field invalid={errors.withheld_category_id !== undefined}>
          <FieldLabel>{t("income.withheldCategory")}</FieldLabel>
          <CategoryPicker
            placeholder={t("income.withheldCategoryPlaceholder")}
            value={draft.withheldCategoryId}
            amount={-1}
            onChange={(id) => {
              set({ withheldCategoryId: id });
            }}
          />
          {errors.withheld_category_id !== undefined && (
            <FieldError>{errors.withheld_category_id}</FieldError>
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

      {children}
    </FormLayout>
  );
}
