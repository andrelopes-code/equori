import { toast } from "@slotted/react/toast";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import { ProblemError, errorText, fieldErrors } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import type { AccountFormSearch } from "@/features/accounts/account-form/account-form-search";
import { useCreateAccount } from "@/features/accounts/api";
import { useEnsureInstitution } from "@/features/accounts/institutions/use-ensure-institution";
import {
  clearAccountDraft,
  draftProblems,
} from "@/features/accounts/model/account-draft";
import type { AccountDraft } from "@/features/accounts/model/account-draft";
import {
  accountInput,
  createAccountSteps,
} from "@/features/accounts/model/create-account-steps";
import { writePendingSetup } from "@/features/accounts/model/pending-setup";
import { useT } from "@/i18n/i18n-provider";

type Account = components["schemas"]["Account"];

interface CreateAccountSubmitInput {
  draft: AccountDraft;
  search: AccountFormSearch;
  accounts: Account[];
}

interface CreateAccountSubmit {
  submit: () => Promise<void>;
  errors: Record<string, string>;
  summary: string | null;
  running: boolean;
}

export const draftKey = "new";

export function useCreateAccountSubmit({
  draft,
  search,
  accounts,
}: CreateAccountSubmitInput): CreateAccountSubmit {
  const t = useT();
  const api = useApi();
  const navigate = useNavigate();
  const create = useCreateAccount();
  const ensureInstitution = useEnsureInstitution();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

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
      account = await create.mutateAsync(
        accountInput(draft, await ensureInstitution(draft)),
      );
    } catch (error) {
      if (error instanceof ProblemError) setErrors(fieldErrors(error.problem));
      setSummary(errorText(error, t));
      setRunning(false);
      return;
    }
    const openingBalances =
      accounts.find((a) => a.system_role === "opening_balances")?.id ?? "";
    const steps = createAccountSteps(draft, {
      openingBalances,
      cashName: t("brokerage.cashName"),
    });
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

  return { submit, errors, summary, running };
}
