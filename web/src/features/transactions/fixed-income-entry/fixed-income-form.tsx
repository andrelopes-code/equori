import { Field, FieldError, FieldLabel } from "@slotted/react/field";

import { PaymentsFields } from "@/features/instruments";
import { BrokerageFields } from "@/features/transactions/brokerage-account/brokerage-fields";
import type { EntryKind } from "@/features/transactions/entry-model/entry-kind";
import { EntryKindPicker } from "@/features/transactions/entry-kind-picker/entry-kind-picker";
import {
  paymentErrors,
  type FixedIncomeDraft,
} from "@/features/transactions/fixed-income-entry/fixed-income-draft";
import { FixedIncomeReturnFields } from "@/features/transactions/fixed-income-entry/fixed-income-return-fields";
import { FixedIncomeTermFields } from "@/features/transactions/fixed-income-entry/fixed-income-term-fields";
import { FixedIncomeWhatFields } from "@/features/transactions/fixed-income-entry/fixed-income-what-fields";
import type { FixedIncomeView } from "@/features/transactions/fixed-income-entry/use-fixed-income-entry";
import { useT } from "@/i18n/i18n-provider";
import { DateInput } from "@/ui/form-fields/date-input";
import { FormLayout } from "@/ui/form-layout/form-layout";
import { FormRow } from "@/ui/form-layout/form-row";
import { FormSection } from "@/ui/form-layout/form-section";
import { MoneyInput } from "@/ui/money/money-input";

interface FixedIncomeFormProps {
  draft: FixedIncomeDraft;
  onChange: (draft: FixedIncomeDraft) => void;
  view: FixedIncomeView;
  errors: Record<string, string>;
  scale: (code: string) => number;
  onKind: (kind: EntryKind) => void;
}

// Families read: field, form-section, date-picker. The amount is the application's own MoneyInput.
export function FixedIncomeForm({
  draft,
  onChange,
  view,
  errors,
  scale,
  onKind,
}: FixedIncomeFormProps) {
  const t = useT();
  const set = (patch: Partial<FixedIncomeDraft>) => {
    onChange({ ...draft, ...patch });
  };
  const currency = view.brokerage?.currency ?? view.base ?? "";

  return (
    <FormLayout>
      <EntryKindPicker value="fixed_income" onChange={onKind} investments />

      <BrokerageFields
        brokerages={view.brokerages}
        brokerage={view.brokerage}
        payers={view.payers}
        payer={view.payer}
        balance={view.balance}
        base={view.base}
        date={draft.appliedOn}
        money="out"
        errors={errors}
        scale={scale}
        onBrokerage={(id) => {
          set({ brokerageId: id, cashAccountId: null });
        }}
        onCash={(id) => {
          set({ cashAccountId: id });
        }}
      />

      <FixedIncomeWhatFields
        draft={draft}
        view={view}
        errors={errors}
        onChange={set}
      />

      <FormSection legend={t("fixedIncome.howMuch")}>
        <FormRow>
          <Field required invalid={errors.amount !== undefined}>
            <FieldLabel>{t("fixedIncome.amount")}</FieldLabel>
            <MoneyInput
              size="field"
              value={draft.amount}
              currency={currency}
              scale={scale(currency)}
              sign="neutral"
              onChange={(amount) => {
                set({ amount });
              }}
            />
            {errors.amount !== undefined && (
              <FieldError>{errors.amount}</FieldError>
            )}
          </Field>

          <Field required invalid={errors.applied_on !== undefined}>
            <FieldLabel>{t("fixedIncome.appliedOn")}</FieldLabel>
            <DateInput
              name="applied_on"
              value={draft.appliedOn}
              onChange={(appliedOn) => {
                set({ appliedOn });
              }}
            />
            {errors.applied_on !== undefined && (
              <FieldError>{errors.applied_on}</FieldError>
            )}
          </Field>
        </FormRow>
      </FormSection>

      {draft.instrument === null && (
        <>
          <FixedIncomeReturnFields
            draft={draft}
            view={view}
            errors={errors}
            onChange={set}
          />

          <FixedIncomeTermFields draft={draft} errors={errors} onChange={set} />

          <PaymentsFields
            draft={draft.payments}
            errors={paymentErrors(errors)}
            onChange={(payments) => {
              set({ payments });
            }}
          />
        </>
      )}
    </FormLayout>
  );
}
