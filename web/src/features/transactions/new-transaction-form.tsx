import { useNavigate, useSearch } from "@tanstack/react-router";
import { Button } from "@slotted/react/button";
import { parseISODate, toISODate } from "@slotted/core/date";
import { DatePicker } from "@slotted/react/date-picker";
import type { Entity } from "@slotted/react/entity-picker";
import { Field, FieldLabel } from "@slotted/react/field";
import { Form, FormActions } from "@slotted/react/form";
import { Segment, SegmentedControl } from "@slotted/react/segmented-control";
import { TagsInput } from "@slotted/react/tags-input";
import { TextField } from "@slotted/react/text-field";
import { toast } from "@slotted/react/toast";
import { useEffect, useReducer, useState } from "react";

import type { components } from "@/api/schema.gen";
import { ProblemError, fieldErrors, problemMessage } from "@/api/problem";
import { useCreateTransaction } from "@/features/transactions/api";
import { AmountField } from "@/features/transactions/amount-field";
import {
  clearDraft,
  loadDraft,
  saveDraft,
} from "@/features/transactions/draft-storage";
import { EntityField } from "@/features/transactions/entity-field";
import styles from "@/features/transactions/new-transaction-page.module.css";
import { PostingsEditor } from "@/features/transactions/postings-editor";
import { validateTransactionSearch } from "@/features/transactions/search";
import { SplitEditor } from "@/features/transactions/split-editor";
import {
  canSave,
  formReducer,
  initialForm,
} from "@/features/transactions/transaction-form-reducer";
import type {
  FormState,
  Mode,
} from "@/features/transactions/transaction-form-reducer";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { useKeyboardInset } from "@/ui/use-keyboard-inset";
import { useViewport } from "@/ui/use-viewport";

// Stands for a payee typed but not stored yet; the transaction request creates it first.
const newPayeeID = "new-payee";

function isMode(value: string): value is Mode {
  return value === "expense" || value === "income" || value === "transfer";
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
  const [problem, setProblem] = useState<ProblemError | null>(null);
  const [state, dispatch] = useReducer(formReducer, undefined, () => {
    const start = loadDraft() ?? initialForm(today);
    return preselected === undefined
      ? start
      : { ...start, accountId: preselected };
  });

  useKeyboardInset(phone);
  useEffect(() => {
    if (isBlank(state)) clearDraft();
    else saveDraft(state);
  }, [state]);

  const open = accounts.filter((a) => a.closed_on === undefined);
  const toEntity = (a: { id: string; name: string }): Entity => ({
    id: a.id,
    label: a.name,
  });
  const balanceAccounts = open
    .filter((a) => a.class === "asset" || a.class === "liability")
    .map(toEntity);
  const categoryClass = state.mode === "income" ? "income" : "expense";
  const counters =
    state.mode === "transfer"
      ? balanceAccounts.filter((a) => a.id !== state.accountId)
      : open.filter((a) => a.class === categoryClass).map(toEntity);
  const allAccounts = open.map(toEntity);
  const payeeEntities: Entity[] = payees.map((p) => ({
    id: p.id,
    label: p.name,
  }));
  if (state.payeeName !== undefined) {
    payeeEntities.push({ id: newPayeeID, label: state.payeeName });
  }

  const currencyOf = (id: string) =>
    accounts.find((a) => a.id === id)?.currency ?? baseCurrency;
  const currency = currencyOf(state.accountId);
  const fields = problem === null ? {} : fieldErrors(problem.problem);
  const amountError =
    problem === null
      ? undefined
      : (fields.postings ??
        fields.amount ??
        problemMessage(problem.problem, t));

  const save = async (another: boolean) => {
    if (!canSave(state)) return;
    setProblem(null);
    try {
      await create.mutateAsync({ state, currencyOf });
    } catch (error) {
      if (error instanceof ProblemError) {
        setProblem(error);
        return;
      }
      throw error;
    }
    toast.show({ title: t("transactions.new.saved") });
    clearDraft();
    if (another) {
      dispatch({ type: "next" });
    } else {
      void navigate({ to: "/transactions", search: {} });
    }
  };

  const date = parseISODate(state.date);
  const transfer = state.mode === "transfer";

  return (
    <Form className={styles.form} summary="none" onSubmit={() => save(false)}>
      {state.postings === null ? (
        <>
          <SegmentedControl
            aria-label={t("transactions.new.mode")}
            value={state.mode}
            fullWidth
            onValueChange={(mode) => {
              if (isMode(mode)) dispatch({ type: "mode", mode });
            }}
          >
            <Segment value="expense">{t("transactions.new.expense")}</Segment>
            <Segment value="income">{t("transactions.new.income")}</Segment>
            <Segment value="transfer">{t("transactions.new.transfer")}</Segment>
          </SegmentedControl>
          <AmountField
            label={t("transactions.new.amount")}
            currency={currency}
            scale={scale(currency)}
            value={state.amount}
            error={amountError}
            onChange={(amount) => {
              dispatch({ type: "amount", amount });
            }}
          />
          <EntityField
            label={t(
              transfer ? "transactions.new.from" : "transactions.new.account",
            )}
            kind="account"
            entities={balanceAccounts}
            value={state.accountId}
            onChange={(id) => {
              dispatch({ type: "account", id });
            }}
          />
          {state.split === null ? (
            <>
              <EntityField
                label={t(
                  transfer
                    ? "transactions.new.to"
                    : "transactions.new.category",
                )}
                kind={transfer ? "account" : "category"}
                entities={counters}
                value={state.counterId}
                onChange={(id) => {
                  dispatch({ type: "counter", id });
                }}
              />
              {!transfer && (
                <Button
                  type="button"
                  tone="secondary"
                  variant="ghost"
                  onClick={() => {
                    dispatch({ type: "split" });
                  }}
                >
                  {t("transactions.new.split")}
                </Button>
              )}
            </>
          ) : (
            <SplitEditor
              state={state}
              dispatch={dispatch}
              categories={counters}
              currency={currency}
              scale={scale(currency)}
            />
          )}
        </>
      ) : (
        <PostingsEditor
          postings={state.postings}
          dispatch={dispatch}
          accounts={allAccounts}
          currencyOf={currencyOf}
          baseCurrency={baseCurrency}
          scale={scale}
          error={amountError}
        />
      )}
      <Field>
        <FieldLabel>{t("transactions.new.date")}</FieldLabel>
        <DatePicker
          value={date}
          onValueChange={(next) => {
            dispatch({
              type: "date",
              date: next !== null && "year" in next ? toISODate(next) : "",
            });
          }}
        />
      </Field>
      <EntityField
        label={t("transactions.filter.payee")}
        kind="payee"
        entities={payeeEntities}
        value={
          state.payeeId ?? (state.payeeName === undefined ? "" : newPayeeID)
        }
        onCreate={(query) => {
          dispatch({ type: "payee", name: query });
          return { id: newPayeeID, label: query };
        }}
        onChange={(id) => {
          if (id === newPayeeID) return;
          dispatch(id === "" ? { type: "payee" } : { type: "payee", id });
        }}
      />
      <Field>
        <FieldLabel>{t("transactions.new.description")}</FieldLabel>
        <TextField
          value={state.description}
          onValueChange={(description) => {
            dispatch({ type: "description", description });
          }}
        />
      </Field>
      <Field>
        <FieldLabel>{t("transactions.new.tags")}</FieldLabel>
        <TagsInput
          value={state.tags}
          onValueChange={(tags) => {
            dispatch({ type: "tags", tags: [...tags] });
          }}
        />
      </Field>
      {state.postings === null && (
        <Button
          type="button"
          tone="secondary"
          variant="ghost"
          onClick={() => {
            dispatch({ type: "advanced", currencyOf });
          }}
        >
          {t("transactions.new.advanced")}
        </Button>
      )}
      <FormActions {...(phone ? { "data-pinned": "true" } : {})}>
        <Button
          type="button"
          tone="secondary"
          variant="outline"
          disabled={!canSave(state) || create.isPending}
          onClick={() => void save(true)}
        >
          {t("transactions.new.saveAnother")}
        </Button>
        <Button type="submit" disabled={!canSave(state) || create.isPending}>
          {t("transactions.new.save")}
        </Button>
      </FormActions>
    </Form>
  );
}
