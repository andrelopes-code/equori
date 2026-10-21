import {
  ActionBar,
  ActionBarAction,
  ActionBarActions,
} from "@slotted/react/action-bar";
import { Button } from "@slotted/react/button";
import { InlineMessage } from "@slotted/react/inline-message";
import { Page, PageBody, PageFooter } from "@slotted/react/page";
import {
  PageHeader,
  PageHeaderBack,
  PageHeaderHeading,
  PageHeaderNav,
  PageHeaderTitle,
  PageHeaderTitleArea,
  PageHeaderTitleRow,
} from "@slotted/react/page-header";
import { toast } from "@slotted/react/toast";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { useApi } from "@/api/api-context";
import { ProblemError, errorText, fieldErrors } from "@/api/problem";
import { accountsQuery } from "@/features/accounts";
import { payeesQuery, settingsQuery, useScale } from "@/features/setup";
import { tagsQuery, useCreateTransaction } from "@/features/transactions/api";
import { emptyDraft, inputFromDraft } from "@/features/transactions/entry-kind";
import type { EntryDraft } from "@/features/transactions/entry-kind";
import { draftProblems } from "@/features/transactions/entry-validation";
import {
  clearDraft,
  readDraft,
  writeDraft,
} from "@/features/transactions/form-draft";
import {
  TransactionForm,
  fieldOf,
} from "@/features/transactions/transaction-form";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { useMediaQuery, wideQuery } from "@/ui/use-media-query";

const draftKey = "new";

export function NewTransactionPage() {
  const t = useT();
  const api = useApi();
  const today = useToday();
  const navigate = useNavigate();
  const { account_id } = useSearch({ from: "/_authed/transactions/new" });
  const accounts = useQuery(accountsQuery(api));
  const payees = useQuery(payeesQuery(api));
  const tags = useQuery(tagsQuery(api));
  const settings = useQuery(settingsQuery(api));
  const scale = useScale();
  const create = useCreateTransaction();
  const wide = useMediaQuery(wideQuery);

  const [draft, setDraft] = useState<EntryDraft>(
    () => readDraft(draftKey) ?? emptyDraft(today, account_id ?? null),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<string | null>(null);
  useEffect(() => {
    writeDraft(draftKey, draft);
  }, [draft]);

  const accountsById = useMemo(
    () => new Map((accounts.data ?? []).map((a) => [a.id, a])),
    [accounts.data],
  );
  const base = settings.data?.base_currency;
  const ready =
    accounts.data !== undefined && base !== undefined && scale !== null;

  const submit = async (next: "list" | "another") => {
    const problems = draftProblems(draft);
    if (Object.keys(problems).length > 0) {
      setErrors(
        Object.fromEntries(
          Object.entries(problems).map(([field, key]) => [field, t(key)]),
        ),
      );
      setSummary(t("entry.fixFields"));
      return;
    }
    if (base === undefined) return;
    setErrors({});
    setSummary(null);
    try {
      const created = await create.mutateAsync(
        inputFromDraft(draft, accountsById, base),
      );
      clearDraft(draftKey);
      toast.show({
        tone: "success",
        title: t("entry.created"),
        actions: (
          <Button
            size="sm"
            variant="ghost"
            tone="secondary"
            onClick={() => {
              void navigate({
                to: "/transactions/$id",
                params: { id: created.id },
              });
            }}
          >
            {t("entry.view")}
          </Button>
        ),
      });
      if (next === "list") {
        void navigate({ to: "/transactions" });
      } else {
        // The next entry keeps how and where money moved, and when.
        setDraft({
          ...emptyDraft(draft.date, draft.accountId),
          kind: draft.kind,
          toAccountId: draft.toAccountId,
        });
      }
    } catch (error) {
      if (error instanceof ProblemError) {
        const byField = fieldErrors(error.problem);
        setErrors(
          Object.fromEntries(
            Object.entries(byField).map(([field, message]) => [
              fieldOf(draft.kind, field),
              message,
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
                    clearDraft(draftKey);
                    void navigate({ to: "/transactions" });
                  }}
                >
                  {t("entry.discard")}
                </Button>
              </ActionBarAction>
              <ActionBarAction>
                <Button
                  variant="outline"
                  tone="secondary"
                  disabled={!ready}
                  loading={create.isPending}
                  onClick={() => {
                    void submit("another");
                  }}
                >
                  {t("entry.saveAnother")}
                </Button>
              </ActionBarAction>
              <ActionBarAction>
                <Button
                  disabled={!ready}
                  loading={create.isPending}
                  aria-keyshortcuts="Control+Enter"
                  onClick={() => {
                    void submit("list");
                  }}
                >
                  {t("entry.save")}
                </Button>
              </ActionBarAction>
            </ActionBarActions>
          </ActionBar>
        </PageFooter>
      }
    >
      <PageHeader size="lg">
        <PageHeaderTitleArea>
          {/* Below 1024 px the shell's top app bar carries the way back. */}
          {wide && (
            <PageHeaderNav>
              <PageHeaderBack
                render={(props) => <Link {...props} to="/transactions" />}
              >
                {t("nav.transactions")}
              </PageHeaderBack>
            </PageHeaderNav>
          )}
          <PageHeaderTitleRow>
            <PageHeaderTitle>
              <PageHeaderHeading>{t("nav.new")}</PageHeaderHeading>
            </PageHeaderTitle>
          </PageHeaderTitleRow>
        </PageHeaderTitleArea>
      </PageHeader>
      <PageBody>
        <form
          noValidate
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
              event.preventDefault();
              void submit("list");
            }
          }}
          onSubmit={(event) => {
            event.preventDefault();
            void submit("list");
          }}
        >
          {summary !== null && (
            <InlineMessage tone="danger">{summary}</InlineMessage>
          )}
          {ready && (
            <TransactionForm
              draft={draft}
              onChange={setDraft}
              accounts={accounts.data}
              payees={payees.data ?? []}
              tags={tags.data ?? []}
              baseCurrency={base}
              scale={scale}
              errors={errors}
              // A phone would open its keyboard over the form before the reader chose to type.
              autoFocusAmount={wide}
            />
          )}
        </form>
      </PageBody>
    </Page>
  );
}
