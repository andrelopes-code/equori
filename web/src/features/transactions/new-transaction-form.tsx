import { useNavigate, useSearch } from "@tanstack/react-router";
import { Alert, AlertContent, AlertDescription } from "@slotted/react/alert";
import { Button } from "@slotted/react/button";
import { Form, FormActions } from "@slotted/react/form";
import { toast } from "@slotted/react/toast";
import { useEffect, useReducer, useState } from "react";

import type { components } from "@/api/schema.gen";
import { ProblemError, fieldErrors, problemMessage } from "@/api/problem";
import { useCreateTransaction } from "@/features/transactions/api";
import {
  clearDraft,
  loadDraft,
  saveDraft,
} from "@/features/transactions/draft-storage";
import styles from "@/features/transactions/new-transaction-page.module.css";
import { validateTransactionSearch } from "@/features/transactions/search";
import { TransactionFields } from "@/features/transactions/transaction-fields";
import {
  canSave,
  formReducer,
  initialForm,
} from "@/features/transactions/transaction-form-reducer";
import type {
  FormAction,
  FormState,
} from "@/features/transactions/transaction-form-reducer";
import { useBalanceAfter } from "@/features/transactions/use-balance-after";
import { useT } from "@/i18n/i18n-provider";
import { InkButton } from "@/ui/ink-button";
import { useToday } from "@/i18n/today";
import { useKeyboardInset } from "@/ui/use-keyboard-inset";
import { useViewport } from "@/ui/use-viewport";

// A 422 field error attaches to the form fields below; any other field, or none, reads as a form-level message.
const mappedFields = ["postings", "amount", "date", "description"];

interface SaveError {
  fields: Record<string, string>;
  message?: string;
}

// A form with nothing typed stores no draft.
function isBlank(state: FormState): boolean {
  return (
    state.amount === null &&
    state.counterId === "" &&
    state.payeeId === undefined &&
    state.payeeName === undefined &&
    state.description === "" &&
    state.tags.length === 0 &&
    state.split === null &&
    state.postings === null
  );
}

export function NewTransactionForm({
  accounts,
  payees,
  baseCurrency,
  scale,
}: {
  accounts: components["schemas"]["Account"][];
  payees: components["schemas"]["Payee"][];
  baseCurrency: string;
  scale: (code: string) => number;
}) {
  const t = useT();
  const today = useToday();
  const navigate = useNavigate();
  const phone = useViewport() === "phone";
  const preselected = validateTransactionSearch(
    useSearch({ strict: false }),
  ).account_id;
  const create = useCreateTransaction();
  const [saveError, setSaveError] = useState<SaveError | null>(null);
  const [state, rawDispatch] = useReducer(formReducer, undefined, () => {
    const start = loadDraft() ?? initialForm(today);
    return preselected === undefined
      ? start
      : { ...start, accountId: preselected };
  });

  // Editing the form dismisses the last save error.
  const dispatch = (action: FormAction) => {
    setSaveError(null);
    rawDispatch(action);
  };

  useKeyboardInset(phone);
  useEffect(() => {
    if (isBlank(state)) clearDraft();
    else saveDraft(state);
  }, [state]);

  const currencyOf = (id: string) =>
    accounts.find((a) => a.id === id)?.currency ?? baseCurrency;
  const amountError = saveError?.fields.postings ?? saveError?.fields.amount;
  const impact = useBalanceAfter({
    accountId: state.postings === null ? state.accountId : null,
    mode: state.mode,
    amount: state.amount,
  });

  const save = async (another: boolean) => {
    if (!canSave(state) || create.isPending) return;
    setSaveError(null);
    try {
      await create.mutateAsync({
        state,
        currencyOf,
        onPayeeCreated: (id) => {
          rawDispatch({ type: "payeeCreated", id });
        },
      });
    } catch (error) {
      if (error instanceof ProblemError) {
        const all = fieldErrors(error.problem);
        const fields = Object.fromEntries(
          Object.entries(all).filter(([field]) => mappedFields.includes(field)),
        );
        const unmapped =
          Object.keys(all).length === 0 ||
          Object.keys(all).length !== Object.keys(fields).length;
        setSaveError({
          fields,
          ...(unmapped ? { message: problemMessage(error.problem, t) } : {}),
        });
      } else {
        setSaveError({ fields: {}, message: t("transactions.new.failed") });
      }
      return;
    }
    toast.show({ title: t("transactions.new.saved") });
    clearDraft();
    if (another) {
      dispatch({ type: "next" });
    } else {
      void navigate({ to: "/transactions", search: {} });
    }
  };

  return (
    <Form
      className={phone ? [styles.form, styles.phone].join(" ") : styles.form}
      summary="none"
      onSubmit={() => save(false)}
    >
      <TransactionFields
        state={state}
        dispatch={dispatch}
        accounts={accounts}
        payees={payees}
        baseCurrency={baseCurrency}
        scale={scale}
        currencyOf={currencyOf}
        errors={{
          amount: amountError,
          date: saveError?.fields.date,
          description: saveError?.fields.description,
        }}
      />
      {saveError?.message !== undefined && (
        <Alert tone="danger" role="alert">
          <AlertContent>
            <AlertDescription>{saveError.message}</AlertDescription>
          </AlertContent>
        </Alert>
      )}
      {impact !== null && (
        <p className={styles.impact} aria-live="polite">
          {impact}
        </p>
      )}
      <FormActions {...(phone ? { "data-pinned": "true" } : {})}>
        <Button
          type="button"
          tone="secondary"
          variant="ghost"
          disabled={!canSave(state) || create.isPending}
          onClick={() => void save(true)}
        >
          {t("transactions.new.saveAnother")}
        </Button>
        <InkButton
          type="submit"
          block={phone}
          size={phone ? "lg" : "md"}
          disabled={!canSave(state) || create.isPending}
        >
          {t("transactions.new.save")}
        </InkButton>
      </FormActions>
    </Form>
  );
}
