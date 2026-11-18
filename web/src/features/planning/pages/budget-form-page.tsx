import { Checkbox } from "@slotted/react/checkbox";
import { Field, FieldError, FieldLabel } from "@slotted/react/field";
import { Page, PageBody } from "@slotted/react/page";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import { ProblemError, errorText, fieldErrors } from "@/api/problem";
import { CategoryPicker } from "@/features/categories";
import { budgetsQuery, useCreateBudget } from "@/features/planning/api";
import { BudgetFormFooter } from "@/features/planning/budget-form/budget-form-footer";
import { BudgetFormHeader } from "@/features/planning/budget-form/budget-form-header";
import { settingsQuery, useScale } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { FormNotice } from "@/ui/form-layout/form-notice";
import { FormLayout } from "@/ui/form-layout/form-layout";
import { MoneyInput } from "@/ui/money/money-input";
import { MonthControl } from "@/ui/navigation/month-control";

// A monthly budget of one category. A category holds one budget: when it has one already, the
// page opens it (409 budget_exists).
export function BudgetFormPage() {
  const t = useT();
  const api = useApi();
  const today = useToday();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const scale = useScale();
  const settings = useQuery(settingsQuery(api));
  const create = useCreateBudget();
  const search = useSearch({ from: "/_authed/planning/budgets/new" });
  const [categoryID, setCategoryID] = useState<string | null>(
    search.category ?? null,
  );
  const [amount, setAmount] = useState(0);
  // CP-04: the first month is stepped from the current one, read as its name (ui/month-control).
  const [from, setFrom] = useState(today.slice(0, 7));
  const [rollover, setRollover] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<string | null>(null);
  const currency = settings.data?.base_currency;
  const open = (id: string) =>
    navigate({ to: "/planning/budgets/$id", params: { id } });

  const submit = () => {
    const next: Record<string, string> = {};
    if (categoryID === null) next.category_id = t("budget.required.category");
    if (amount <= 0) next.amount = t("budget.required.amount");
    setErrors(next);
    setSummary(null);
    if (
      Object.keys(next).length > 0 ||
      categoryID === null ||
      currency === undefined
    )
      return;
    create
      .mutateAsync({
        category_id: categoryID,
        amount: { amount, currency },
        effective_from: from,
        rollover,
      })
      .then((budget) => open(budget.id))
      .catch(async (caught: unknown) => {
        if (
          caught instanceof ProblemError &&
          caught.problem.code === "budget_exists"
        ) {
          const existing = (await queryClient.query(budgetsQuery(api))).find(
            (b) => b.category_id === categoryID,
          );
          if (existing !== undefined) return open(existing.id);
        }
        if (caught instanceof ProblemError)
          setErrors(fieldErrors(caught.problem));
        setSummary(errorText(caught, t));
      });
  };

  return (
    <Page
      width="wide"
      footer={
        <BudgetFormFooter
          pending={create.isPending}
          disabled={currency === undefined || scale === null}
          onSubmit={submit}
        />
      }
    >
      <BudgetFormHeader />
      <PageBody>
        <FormLayout>
          {summary !== null && <FormNotice>{summary}</FormNotice>}

          <Field invalid={errors.category_id !== undefined} required>
            <FieldLabel>{t("budget.category")}</FieldLabel>
            <CategoryPicker
              aria-label={t("budget.category")}
              value={categoryID}
              amount={-1}
              invalid={errors.category_id !== undefined}
              onChange={setCategoryID}
            />
            {errors.category_id !== undefined && (
              <FieldError>{errors.category_id}</FieldError>
            )}
          </Field>

          <Field width="medium" invalid={errors.amount !== undefined} required>
            <FieldLabel>{t("budget.amount")}</FieldLabel>
            {currency !== undefined && scale !== null && (
              <MoneyInput
                size="field"
                value={amount}
                onChange={setAmount}
                currency={currency}
                scale={scale(currency)}
                sign="neutral"
              />
            )}
            {errors.amount !== undefined && (
              <FieldError>{errors.amount}</FieldError>
            )}
          </Field>

          <Field invalid={errors.effective_from !== undefined} required>
            <FieldLabel>{t("budget.firstMonth")}</FieldLabel>
            <MonthControl
              label={t("budget.firstMonth")}
              value={from}
              onChange={setFrom}
            />
            {errors.effective_from !== undefined && (
              <FieldError>{errors.effective_from}</FieldError>
            )}
          </Field>

          <Checkbox
            checked={rollover}
            onCheckedChange={setRollover}
            description={t("budget.rolloverHint")}
          >
            {t("budget.rollover")}
          </Checkbox>
        </FormLayout>
      </PageBody>
    </Page>
  );
}
