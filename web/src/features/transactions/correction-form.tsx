import {
  ActionBar,
  ActionBarAction,
  ActionBarActions,
} from "@slotted/react/action-bar";
import { Button } from "@slotted/react/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@slotted/react/field";
import { InlineMessage } from "@slotted/react/inline-message";
import { Page, PageBody, PageFooter } from "@slotted/react/page";
import {
  PageHeader,
  PageHeaderBack,
  PageHeaderHeading,
  PageHeaderNav,
  PageHeaderSubheading,
  PageHeaderTitle,
  PageHeaderTitleArea,
  PageHeaderTitleRow,
} from "@slotted/react/page-header";
import { Stack } from "@slotted/react/stack";
import { TextField } from "@slotted/react/text-field";
import { toast } from "@slotted/react/toast";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { useApi } from "@/api/api-context";
import { ProblemError, errorText, fieldErrors } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import {
  transactionQuery,
  useCorrectTransaction,
} from "@/features/transactions/api";
import { CorrectionConflict } from "@/features/transactions/correction-conflict";
import {
  draftFromTransaction,
  inputFromDraft,
} from "@/features/transactions/entry-kind";
import type { EntryDraft } from "@/features/transactions/entry-kind";
import { draftProblems } from "@/features/transactions/entry-validation";
import { movedFields } from "@/features/transactions/moved-fields";
import type { MovedField } from "@/features/transactions/moved-fields";
import {
  TransactionForm,
  fieldOf,
} from "@/features/transactions/transaction-form";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMediaQuery, wideQuery } from "@/ui/use-media-query";

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
  const [locale] = useAppLocale();
  const api = useApi();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const wide = useMediaQuery(wideQuery);
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
    const problems = draftProblems(draft);
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
      if (error instanceof ProblemError && error.status === 409) {
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
      width="content"
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
      <PageHeader size="lg">
        <PageHeaderTitleArea>
          {wide && (
            <PageHeaderNav>
              <PageHeaderBack
                render={(props) => (
                  <Link
                    {...props}
                    to="/transactions/$id"
                    params={{ id: transaction.id }}
                  />
                )}
              >
                {transaction.description || t("detail.title")}
              </PageHeaderBack>
            </PageHeaderNav>
          )}
          <PageHeaderTitleRow>
            <PageHeaderTitle>
              <PageHeaderHeading>{t("correct.title")}</PageHeaderHeading>
              <PageHeaderSubheading>
                {t("correct.subtitle", {
                  date: formatDate(transaction.date, locale),
                  version: version,
                })}
              </PageHeaderSubheading>
            </PageHeaderTitle>
          </PageHeaderTitleRow>
        </PageHeaderTitleArea>
      </PageHeader>
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
          {summary !== null && (
            <InlineMessage tone="danger">{summary}</InlineMessage>
          )}
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
            <Field invalid={errors.reason !== undefined} required>
              <FieldLabel>{t("correct.reason")}</FieldLabel>
              <TextField
                name="reason"
                value={reason}
                maxLength={500}
                onChange={(event) => {
                  setReason(event.target.value);
                }}
              />
              <FieldDescription>{t("correct.reasonHint")}</FieldDescription>
              {errors.reason !== undefined && (
                <FieldError>{errors.reason}</FieldError>
              )}
            </Field>
          </TransactionForm>
        </Stack>
      </PageBody>
    </Page>
  );
}
