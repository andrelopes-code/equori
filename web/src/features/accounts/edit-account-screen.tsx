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
import { useState } from "react";

import { ProblemError, errorText, fieldErrors } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import {
  draftFromAccount,
  draftProblems,
} from "@/features/accounts/account-draft";
import type { AccountDraft } from "@/features/accounts/account-draft";
import { AccountForm } from "@/features/accounts/account-form";
import { AccountFormHeader } from "@/features/accounts/account-form-header";
import styles from "@/features/accounts/account-form.module.css";
import { AccountPreview } from "@/features/accounts/account-preview";
import {
  useSetAppearance,
  useSetParent,
  useUpdateAccount,
} from "@/features/accounts/api";
import { yieldCapable } from "@/features/accounts/account-kinds";
import { useT } from "@/i18n/i18n-provider";

type Account = components["schemas"]["Account"];
type AccountPatch = components["schemas"]["AccountPatch"];

// FM-09: the commands carry only the fields that moved since the form opened.
function movedPatch(start: AccountDraft, draft: AccountDraft): AccountPatch {
  return {
    ...(draft.name.trim() !== start.name ? { name: draft.name.trim() } : {}),
    ...(draft.institutionId !== start.institutionId &&
    draft.institutionId !== null
      ? { institution_id: draft.institutionId }
      : {}),
    ...(draft.yieldAuto !== start.yieldAuto &&
    draft.kind !== null &&
    yieldCapable(draft.kind)
      ? { yield_mode: draft.yieldAuto ? "auto" : "none" }
      : {}),
    ...(draft.excludedFromLiquidity !== start.excludedFromLiquidity
      ? { excluded_from_liquidity: draft.excludedFromLiquidity }
      : {}),
  };
}

export function EditAccountScreen({
  account,
  accounts,
  scale,
}: {
  account: Account;
  accounts: Account[];
  scale: (code: string) => number;
}) {
  const t = useT();
  const navigate = useNavigate();
  const update = useUpdateAccount();
  const setParent = useSetParent();
  const setAppearance = useSetAppearance();
  const [start] = useState(() => draftFromAccount(account));
  const [draft, setDraft] = useState(start);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const back =
    account.kind === "credit_card"
      ? ({
          to: "/cards/$accountId",
          params: { accountId: account.id },
        } as const)
      : ({ to: "/accounts/$id", params: { id: account.id } } as const);

  const submit = async () => {
    const problems = draftProblems(draft, "edit");
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
    try {
      const patch = movedPatch(start, draft);
      if (Object.keys(patch).length > 0) {
        await update.mutateAsync({ id: account.id, patch });
      }
      if (draft.parentId !== start.parentId) {
        await setParent.mutateAsync({
          id: account.id,
          parentId: draft.parentId,
        });
      }
      if (draft.color !== start.color) {
        await setAppearance.mutateAsync({ id: account.id, color: draft.color });
      }
    } catch (error) {
      if (error instanceof ProblemError) setErrors(fieldErrors(error.problem));
      setSummary(errorText(error, t));
      setRunning(false);
      return;
    }
    setRunning(false);
    toast.show({
      tone: "success",
      title: t("accountForm.saved", { name: draft.name.trim() }),
    });
    void navigate(back);
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
                    void navigate(back);
                  }}
                >
                  {t("detail.cancel")}
                </Button>
              </ActionBarAction>
              <ActionBarAction>
                <Button loading={running} onClick={() => void submit()}>
                  {t("detail.save")}
                </Button>
              </ActionBarAction>
            </ActionBarActions>
          </ActionBar>
        </PageFooter>
      }
    >
      <AccountFormHeader
        title={t("accountForm.editTitle")}
        subtitle={t("accountForm.editSubtitle")}
        back={back}
        backLabel={account.name}
      />
      <PageBody>
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
                mode="edit"
                draft={draft}
                onChange={setDraft}
                accounts={accounts}
                editingId={account.id}
                currencies={[account.currency]}
                scale={scale}
                errors={errors}
              />
              <div className={styles.aside}>
                <AccountPreview draft={draft} scale={scale} />
              </div>
            </div>
          </Stack>
        </form>
      </PageBody>
    </Page>
  );
}
