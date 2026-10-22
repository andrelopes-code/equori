import {
  ActionBar,
  ActionBarAction,
  ActionBarActions,
} from "@slotted/react/action-bar";
import { Button } from "@slotted/react/button";
import { InlineMessage } from "@slotted/react/inline-message";
import { Page, PageBody, PageFooter } from "@slotted/react/page";
import { Stack } from "@slotted/react/stack";
import { toast } from "@slotted/react/toast";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { useApi } from "@/api/api-context";
import { ProblemError, errorText, fieldErrors } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import {
  clearAccountDraft,
  draftProblems,
  emptyAccountDraft,
  readAccountDraft,
  writeAccountDraft,
} from "@/features/accounts/account-draft";
import type { AccountDraft } from "@/features/accounts/account-draft";
import { AccountForm } from "@/features/accounts/account-form";
import { AccountFormHeader } from "@/features/accounts/account-form-header";
import styles from "@/features/accounts/account-form.module.css";
import type { AccountFormSearch } from "@/features/accounts/account-form-search";
import { AccountPreview } from "@/features/accounts/account-preview";
import { useCreateAccount } from "@/features/accounts/api";
import {
  accountInput,
  createAccountSteps,
} from "@/features/accounts/create-account-steps";
import { KindChooser } from "@/features/accounts/kind-chooser";
import { writePendingSetup } from "@/features/accounts/pending-setup";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";

type Account = components["schemas"]["Account"];

const draftKey = "new";

export function NewAccountScreen({
  search,
  accounts,
  base,
  currencies,
  scale,
}: {
  search: AccountFormSearch;
  accounts: Account[];
  base: string;
  currencies: string[];
  scale: (code: string) => number;
}) {
  const t = useT();
  const api = useApi();
  const today = useToday();
  const navigate = useNavigate();
  const create = useCreateAccount();
  const [draft, setDraft] = useState<AccountDraft>(() => {
    const stored = readAccountDraft(draftKey) ?? emptyAccountDraft(today, base);
    return {
      ...stored,
      ...(search.kind === undefined ? {} : { kind: search.kind }),
      ...(search.name !== undefined && stored.name === ""
        ? { name: search.name }
        : {}),
    };
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  useEffect(() => {
    writeAccountDraft(draftKey, draft);
  }, [draft]);

  const destination = (account: Account) =>
    account.kind === "credit_card"
      ? navigate({ to: "/cards/$accountId", params: { accountId: account.id } })
      : navigate({ to: "/accounts/$id", params: { id: account.id } });

  const submit = async () => {
    const problems = draftProblems(draft, "create");
    if (Object.keys(problems).length > 0) {
      setErrors(
        Object.fromEntries(
          Object.entries(problems).map(([f, key]) => [f, t(key)]),
        ),
      );
      setSummary(t("accountForm.fixFields"));
      return;
    }
    setErrors({});
    setSummary(null);
    setRunning(true);
    let account: Account;
    try {
      account = await create.mutateAsync(accountInput(draft));
    } catch (error) {
      if (error instanceof ProblemError) setErrors(fieldErrors(error.problem));
      setSummary(errorText(error, t));
      setRunning(false);
      return;
    }
    const openingBalances =
      accounts.find((a) => a.system_role === "opening_balances")?.id ?? "";
    const steps = createAccountSteps(draft, { openingBalances });
    let done = 0;
    try {
      for (const step of steps) {
        await step.run(api, account.id);
        done += 1;
      }
    } catch {
      // The account exists: its page offers the remaining steps again.
      writePendingSetup(account.id, { draft, done });
      clearAccountDraft(draftKey);
      setRunning(false);
      void destination(account);
      return;
    }
    clearAccountDraft(draftKey);
    setRunning(false);
    toast.show({
      tone: "success",
      title: t("accountForm.created", { name: account.name }),
    });
    if (search.return === "links") {
      void navigate({
        to: "/accounts/links",
        search: {
          account: account.id,
          ...(search.external === undefined
            ? {}
            : { external: search.external }),
          ...(search.connection === undefined
            ? {}
            : { connection: search.connection }),
        },
      });
    } else {
      void destination(account);
    }
  };

  return (
    <Page
      width="wide"
      footer={
        <PageFooter>
          <ActionBar aria-label={t("accountForm.actions")}>
            <ActionBarActions>
              <ActionBarAction>
                <Button
                  variant="ghost"
                  tone="secondary"
                  onClick={() => {
                    clearAccountDraft(draftKey);
                    void navigate({ to: "/accounts" });
                  }}
                >
                  {t("accountForm.discard")}
                </Button>
              </ActionBarAction>
              <ActionBarAction>
                <Button
                  disabled={draft.kind === null}
                  loading={running}
                  onClick={() => void submit()}
                >
                  {t("accountForm.create")}
                </Button>
              </ActionBarAction>
            </ActionBarActions>
          </ActionBar>
        </PageFooter>
      }
    >
      <AccountFormHeader
        title={t("accountForm.newTitle")}
        subtitle={t("accountForm.newSubtitle")}
        back={{ to: "/accounts" }}
        backLabel={t("nav.accounts")}
      />
      <PageBody>
        {draft.kind === null ? (
          <KindChooser
            value={draft.kind}
            onChange={(kind) => {
              setDraft({ ...draft, kind });
            }}
          />
        ) : (
          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <Stack gap={6}>
              {summary !== null && (
                <InlineMessage tone="danger">{summary}</InlineMessage>
              )}
              <div className={styles.layout}>
                <AccountForm
                  mode="create"
                  draft={draft}
                  onChange={setDraft}
                  onChangeKind={() => {
                    setDraft({ ...draft, kind: null });
                  }}
                  accounts={accounts}
                  currencies={currencies}
                  scale={scale}
                  errors={errors}
                />
                <div className={styles.aside}>
                  <AccountPreview draft={draft} scale={scale} />
                </div>
              </div>
            </Stack>
          </form>
        )}
      </PageBody>
    </Page>
  );
}
