import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { useApi } from "@/api/api-context";
import { ProblemError, errorText, fieldErrors } from "@/api/problem";
import {
  accountInput,
  accountsQuery,
  createAccountSteps,
  draftProblems,
  useCreateAccount,
  useEnsureInstitution,
  writePendingSetup,
} from "@/features/accounts";
import type { AccountDraft } from "@/features/accounts";
import { useT } from "@/i18n/i18n-provider";

export interface GroupRun {
  state: "pending" | "created" | "failed";
  accountId?: string;
  errors: Record<string, string>;
  summary: string | null;
  pendingSetup: boolean;
}

export const pending: GroupRun = {
  state: "pending",
  errors: {},
  summary: null,
  pendingSetup: false,
};

// Creates the accounts of the drafts one after the other. A run starts at the first draft not
// created, so a retry never creates an account twice.
export function useStartRun(
  drafts: readonly AccountDraft[],
  initial: readonly GroupRun[],
) {
  const t = useT();
  const api = useApi();
  const create = useCreateAccount();
  const ensureInstitution = useEnsureInstitution();
  const accounts = useQuery(accountsQuery(api));
  const [groups, setGroups] = useState<GroupRun[]>([...initial]);
  const [running, setRunning] = useState(false);
  // The loop reads the groups it has just written, before the next render.
  const latest = useRef<GroupRun[]>([...initial]);

  const runs = drafts.map((_, index) => groups[index] ?? pending);

  function reset() {
    latest.current = [];
    setGroups([]);
  }

  async function run() {
    setRunning(true);
    for (const [index, draft] of drafts.entries()) {
      if (latest.current[index]?.state === "created") continue;
      if (!(await runGroup(index, draft))) break;
    }
    setRunning(false);
  }

  function commit(index: number, value: GroupRun) {
    const next = [...latest.current];
    next[index] = value;
    latest.current = next;
    setGroups(next);
  }

  async function runGroup(index: number, draft: AccountDraft) {
    const problems = draftProblems(draft, "create");
    if (Object.keys(problems).length > 0) {
      commit(index, {
        ...pending,
        state: "failed",
        errors: Object.fromEntries(
          Object.entries(problems).map(([field, key]) => [field, t(key)]),
        ),
        summary: t("accountForm.fixFields"),
      });
      return false;
    }

    let account;
    try {
      account = await create.mutateAsync(
        accountInput(draft, await ensureInstitution(draft)),
      );
    } catch (error) {
      commit(index, {
        ...pending,
        state: "failed",
        errors: error instanceof ProblemError ? fieldErrors(error.problem) : {},
        summary: errorText(error, t),
      });
      return false;
    }

    const openingBalances =
      accounts.data?.find((a) => a.system_role === "opening_balances")?.id ??
      "";
    let done = 0;
    let complete = true;
    try {
      for (const step of createAccountSteps(draft, { openingBalances })) {
        await step.run(api, account.id);
        done += 1;
      }
    } catch {
      // The account exists: its page offers the remaining steps again.
      writePendingSetup(account.id, { draft, done });
      complete = false;
    }
    commit(index, {
      ...pending,
      state: "created",
      accountId: account.id,
      pendingSetup: !complete,
    });

    return true;
  }

  return {
    runs,
    running,
    anyCreated: runs.some((r) => r.state === "created"),
    allCreated: runs.every((r) => r.state === "created"),
    run,
    reset,
  };
}
