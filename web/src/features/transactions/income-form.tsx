import { parseISODate, toISODate } from "@slotted/core/date";
import { DatePicker } from "@slotted/react/date-picker";
import { Field, FieldError, FieldLabel } from "@slotted/react/field";
import { Stack } from "@slotted/react/stack";
import { TextField } from "@slotted/react/text-field";

import { CategoryPicker } from "@/features/categories";
import { catalogLabel } from "@/features/setup";
import { BrokerageAccountFields } from "@/features/transactions/brokerage-account-fields";
import { EntryKindPicker } from "@/features/transactions/entry-kind-picker";
import type { EntryKind } from "@/features/transactions/entry-kind";
import type { IncomeDraft } from "@/features/transactions/income-draft";
import type { useIncomeEntry } from "@/features/transactions/use-income-entry";
import styles from "@/features/transactions/transaction-form.module.css";
import { useT } from "@/i18n/i18n-provider";
import { ChoiceSelect } from "@/ui/choice-select";
import { DateShortcuts } from "@/ui/date-shortcuts";
import { FigureCard } from "@/ui/figure-card";
import { FigureGrid } from "@/ui/figure-grid";
import { MoneyInput } from "@/ui/money-input";

// Families read: select, field, text-field, stat-card. The type is a choice from the list the API
// returns (a jurisdiction's types, never a literal); the amounts are the application's MoneyInput.
export function IncomeForm({
  draft,
  onChange,
  view,
  errors,
  scale,
  onKind,
}: {
  draft: IncomeDraft;
  onChange: (draft: IncomeDraft) => void;
  view: ReturnType<typeof useIncomeEntry>["view"];
  errors: Record<string, string>;
  scale: (code: string) => number;
  onKind: (kind: EntryKind) => void;
}) {
  const t = useT();
  const set = (patch: Partial<IncomeDraft>) => {
    onChange({ ...draft, ...patch });
  };
  const { base } = view;
  const baseScale = base === undefined ? 0 : scale(base);

  return (
    <Stack gap={6}>
      <EntryKindPicker
        value="investment_income"
        onChange={onKind}
        investments
      />

      <BrokerageAccountFields
        securities={view.securities}
        security={view.security}
        cashChoices={view.cashChoices}
        cashAccountId={view.cashAccountId}
        base={base}
        ready={view.ready}
        date={draft.date}
        money="in"
        errors={errors}
        scale={scale}
        onSecurity={(id) => {
          set({ accountId: id });
        }}
        onCash={(id) => {
          set({ cashAccountId: id });
        }}
      />

      <Field invalid={errors.income_type !== undefined}>
        <FieldLabel>{t("income.type")}</FieldLabel>
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

      <Field invalid={errors.date !== undefined}>
        <FieldLabel>{t("entry.date")}</FieldLabel>
        <div className={styles.date}>
          <DatePicker
            name="date"
            value={parseISODate(draft.date)}
            onValueChange={(value) => {
              if (value !== null && !Array.isArray(value) && "year" in value) {
                set({ date: toISODate(value) });
              }
            }}
          />
          <DateShortcuts
            value={draft.date}
            onChange={(date) => {
              set({ date });
            }}
          />
        </div>
        {errors.date !== undefined && <FieldError>{errors.date}</FieldError>}
      </Field>

      <div className={styles.pair}>
        <Field invalid={errors.gross !== undefined}>
          <FieldLabel>{t("income.gross")}</FieldLabel>
          <MoneyInput
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
        <Field invalid={errors.withheld !== undefined}>
          <FieldLabel>{t("income.withheld")}</FieldLabel>
          <MoneyInput
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
      </div>

      <div className={styles.pair}>
        <Field invalid={errors.category_id !== undefined}>
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
      </div>

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
    </Stack>
  );
}
