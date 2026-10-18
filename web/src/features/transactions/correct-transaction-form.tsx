import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Alert, AlertContent, AlertDescription } from "@slotted/react/alert";
import { Button } from "@slotted/react/button";
import type { Entity } from "@slotted/react/entity-picker";
import { Field, FieldError, FieldLabel } from "@slotted/react/field";
import { Form, FormActions } from "@slotted/react/form";
import { InlineMessage } from "@slotted/react/inline-message";
import { TextField } from "@slotted/react/text-field";
import { toast } from "@slotted/react/toast";
import { useReducer, useState } from "react";

import { ProblemError, fieldErrors, problemMessage } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import {
  transactionKeys,
  useCorrectTransaction,
} from "@/features/transactions/api";
import styles from "@/features/transactions/new-transaction-page.module.css";
import pageStyles from "@/features/transactions/transaction-page.module.css";
import { PostingsEditor } from "@/features/transactions/postings-editor";
import { TransactionMetaFields } from "@/features/transactions/transaction-meta-fields";
import {
  canSave,
  formReducer,
  fromTransaction,
} from "@/features/transactions/transaction-form-reducer";
import { useT } from "@/i18n/i18n-provider";

// The edits live in the reducer, which a refetch of the transaction never resets: that is the draft kept across a conflict.
export function CorrectTransactionForm({
  transaction,
  accounts,
  payees,
  baseCurrency,
  scale,
}: {
  transaction: components["schemas"]["Transaction"];
  accounts: components["schemas"]["Account"][];
  payees: components["schemas"]["Payee"][];
  baseCurrency: string;
  scale: (code: string) => number;
}) {
  const t = useT();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const correct = useCorrectTransaction();
  const [state, dispatch] = useReducer(
    formReducer,
    transaction,
    fromTransaction,
  );
  const [reason, setReason] = useState("");
  const [reasonMissing, setReasonMissing] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [saveError, setSaveError] = useState<{
    fields: Record<string, string>;
    message?: string;
  } | null>(null);

  const entities: Entity[] = accounts.map((a) => ({ id: a.id, label: a.name }));
  const currencyOf = (id: string) =>
    accounts.find((a) => a.id === id)?.currency ?? baseCurrency;

  const save = async () => {
    if (correct.isPending) return;
    if (reason.trim() === "") {
      setReasonMissing(true);
      return;
    }
    if (!canSave(state)) return;
    setSaveError(null);
    try {
      await correct.mutateAsync({
        current: transaction,
        state,
        currencyOf,
        reason: reason.trim(),
        onPayeeCreated: (id) => {
          dispatch({ type: "payeeCreated", id });
        },
      });
    } catch (error) {
      if (
        error instanceof ProblemError &&
        error.problem.code === "version_conflict"
      ) {
        await queryClient.refetchQueries({
          queryKey: transactionKeys.detail(transaction.id),
        });
        setConflict(true);
      } else if (error instanceof ProblemError) {
        setSaveError({
          fields: fieldErrors(error.problem),
          message: problemMessage(error.problem, t),
        });
      } else {
        setSaveError({ fields: {}, message: t("transaction.failed") });
      }
      return;
    }
    toast.show({ title: t("transaction.correct.saved") });
    void navigate({ to: "/transactions/$id", params: { id: transaction.id } });
  };

  return (
    <Form
      className={styles.form}
      summary="none"
      onSubmit={() => {
        void save();
      }}
    >
      {state.postings !== null && (
        <PostingsEditor
          postings={state.postings}
          dispatch={dispatch}
          accounts={entities}
          currencyOf={currencyOf}
          baseCurrency={baseCurrency}
          scale={scale}
          error={saveError?.fields.postings}
          canQuick={false}
        />
      )}
      <TransactionMetaFields
        state={state}
        dispatch={dispatch}
        payees={payees}
        errors={{
          ...(saveError?.fields.date === undefined
            ? {}
            : { date: saveError.fields.date }),
          ...(saveError?.fields.description === undefined
            ? {}
            : { description: saveError.fields.description }),
        }}
      />
      <Field invalid={reasonMissing}>
        <FieldLabel>{t("transaction.correct.reason")}</FieldLabel>
        <TextField
          value={reason}
          onValueChange={(next) => {
            setReason(next);
            setReasonMissing(false);
          }}
        />
        {reasonMissing && (
          <FieldError>{t("transaction.correct.reasonRequired")}</FieldError>
        )}
      </Field>
      {conflict && (
        <div className={pageStyles.conflict}>
          <InlineMessage tone="warning" live="assertive" size="md">
            {t("transaction.correct.conflict", {
              version: String(transaction.version),
            })}
          </InlineMessage>
          <Button
            type="button"
            tone="secondary"
            variant="outline"
            disabled={correct.isPending}
            onClick={() => void save()}
          >
            {t("transaction.correct.reapply")}
          </Button>
        </div>
      )}
      {saveError?.message !== undefined && (
        <Alert tone="danger" role="alert">
          <AlertContent>
            <AlertDescription>{saveError.message}</AlertDescription>
          </AlertContent>
        </Alert>
      )}
      <FormActions>
        <Button
          type="button"
          tone="secondary"
          variant="outline"
          onClick={() => {
            void navigate({
              to: "/transactions/$id",
              params: { id: transaction.id },
            });
          }}
        >
          {t("transaction.cancel")}
        </Button>
        <Button type="submit" disabled={!canSave(state) || correct.isPending}>
          {t("transaction.correct.save")}
        </Button>
      </FormActions>
    </Form>
  );
}
