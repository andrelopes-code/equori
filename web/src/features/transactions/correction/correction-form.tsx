import {
  ActionBar,
  ActionBarAction,
  ActionBarActions,
} from "@slotted/react/action-bar";
import { Button } from "@slotted/react/button";
import { Page, PageBody, PageFooter } from "@slotted/react/page";
import { Stack } from "@slotted/react/stack";
import { toast } from "@slotted/react/toast";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { useApi } from "@/api/api-context";
import { ProblemError, errorText, fieldErrors } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import {
  transactionQuery,
  useCorrectTransaction,
} from "@/features/transactions/api";
import { CorrectionConflict } from "@/features/transactions/correction/correction-conflict";
import { CorrectionHeader } from "@/features/transactions/correction/correction-header";
import { ReasonField } from "@/features/transactions/correction/reason-field";
import {
  draftFromTransaction,
  inputFromDraft,
} from "@/features/transactions/entry-model/entry-kind";
import type { EntryDraft } from "@/features/transactions/entry-model/entry-kind";
import { draftProblems } from "@/features/transactions/entry-model/entry-validation";
import { movedFields } from "@/features/transactions/correction/moved-fields";
import type { MovedField } from "@/features/transactions/correction/moved-fields";
import { fieldOf } from "@/features/transactions/entry-model/field-of";
import { TransactionForm } from "@/features/transactions/transaction-form/transaction-form";
import { useT } from "@/i18n/i18n-provider";
import { FormNotice } from "@/ui/form-layout/form-notice";

type Account = components["schemas"]["Account"];
type Payee = components["schemas"]["Payee"];
type Transaction = components["schemas"]["Transaction"];

interface Conflict {
  stored: EntryDraft;
  version: number;
  moved: MovedField[];
}

export function CorrectionForm({
  transaction,
  accounts,
  payees,
  tags,
  baseCurrency,
  scale,
}: {
  transaction: Transaction;
  accounts: readonly Account[];
  payees: readonly Payee[];
  tags: readonly string[];
  baseCurrency: string;
  scale: (code: string) => number;
}) {
  const t = useT();
  const api = useApi();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const correct = useCorrectTransaction();
  const accountsById = useMemo(
    () => new Map(accounts.map((a) => [a.id, a])),
    [accounts],
  );

  // ER-03: the version is held as a number from the read the form opened on.
  const [opened, setOpened] = useState(() =>
    draftFromTransaction(transaction, accountsById),
  );
  const [version, setVersion] = useState(transaction.version);
  const [draft, setDraft] = useState(opened);
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<string | null>(null);
  const [conflict, setConflict] = useState<Conflict | null>(null);

  const send = async (expected: number) => {
    const problems = draftProblems(draft, accountsById, baseCurrency);
    const local: Record<string, string> = Object.fromEntries(
      Object.entries(problems).map(([field, key]) => [field, t(key)]),
    );
    if (reason.trim() === "") local.reason = t("correct.reasonRequired");
    if (Object.keys(local).length > 0) {
      setErrors(local);
      setSummary(t("entry.fixFields"));
      return;
    }
    setErrors({});
    setSummary(null);
    try {
      await correct.mutateAsync({
        current: { ...transaction, version: expected },
        body: {
          ...inputFromDraft(draft, accountsById, baseCurrency),
          expected_version: expected,
          reason: reason.trim(),
        },
      });
      toast.show({ tone: "success", title: t("correct.done") });
      void navigate({
        to: "/transactions/$id",
        params: { id: transaction.id },
      });
    } catch (error) {
      if (
        error instanceof ProblemError &&
        error.problem.code === "version_conflict"
      ) {
        // ER-02: the record is read again before the message is shown.
        const fresh = await queryClient.query({
          ...transactionQuery(api, transaction.id),
          staleTime: 0,
        });
        const stored = draftFromTransaction(fresh, accountsById);
        setConflict({
          stored,
          version: fresh.version,
          moved: movedFields(opened, stored),
        });
        return;
      }
      if (error instanceof ProblemError) {
        setErrors(
          Object.fromEntries(
            Object.entries(fieldErrors(error.problem)).map(([field, msg]) => [
              fieldOf(draft.kind, field),
              msg,
            ]),
          ),
        );
      }
      setSummary(errorText(error, t));
    }
  };

  return (
    <Page
      width="wide"
      footer={
        <PageFooter>
          <ActionBar aria-label={t("entry.actions")}>
            <ActionBarActions>
              <ActionBarAction>
                <Button
                  variant="ghost"
                  tone="secondary"
                  onClick={() => {
                    void navigate({
                      to: "/transactions/$id",
                      params: { id: transaction.id },
                    });
                  }}
                >
                  {t("detail.cancel")}
                </Button>
              </ActionBarAction>
              <ActionBarAction>
                <Button
                  loading={correct.isPending}
                  disabled={conflict !== null}
                  onClick={() => {
                    void send(version);
                  }}
                >
                  {t("correct.save")}
                </Button>
              </ActionBarAction>
            </ActionBarActions>
          </ActionBar>
        </PageFooter>
      }
    >
      <CorrectionHeader transaction={transaction} version={version} />
      <PageBody>
        <Stack gap={5}>
          {conflict !== null && (
            <CorrectionConflict
              moved={conflict.moved}
              busy={correct.isPending}
              onRestart={() => {
                setOpened(conflict.stored);
                setDraft(conflict.stored);
                setVersion(conflict.version);
                setConflict(null);
              }}
              onOverwrite={() => {
                setOpened(conflict.stored);
                setVersion(conflict.version);
                setConflict(null);
                void send(conflict.version);
              }}
            />
          )}
          {summary !== null && <FormNotice>{summary}</FormNotice>}
          <TransactionForm
            draft={draft}
            onChange={setDraft}
            accounts={accounts}
            payees={payees}
            tags={tags}
            baseCurrency={baseCurrency}
            scale={scale}
            errors={errors}
          >
            <ReasonField
              value={reason}
              error={errors.reason}
              onChange={setReason}
            />
          </TransactionForm>
        </Stack>
      </PageBody>
    </Page>
  );
}
