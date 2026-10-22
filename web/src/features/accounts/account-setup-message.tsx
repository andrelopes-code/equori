import { Button } from "@slotted/react/button";
import {
  Alert,
  AlertActions,
  AlertContent,
  AlertDescription,
  AlertTitle,
} from "@slotted/react/alert";
import { toast } from "@slotted/react/toast";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import { errorText } from "@/api/problem";
import { accountsQuery } from "@/features/accounts/api";
import {
  createAccountSteps,
  stepLabel,
} from "@/features/accounts/create-account-steps";
import {
  clearPendingSetup,
  readPendingSetup,
  writePendingSetup,
} from "@/features/accounts/pending-setup";
import { useT } from "@/i18n/i18n-provider";

// The steps that failed after the account was created, offered again on its page.
export function AccountSetupMessage({ accountId }: { accountId: string }) {
  const t = useT();
  const api = useApi();
  const accounts = useQuery(accountsQuery(api));
  const [pending, setPending] = useState(() => readPendingSetup(accountId));
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (pending === null) return null;
  const openingBalances =
    accounts.data?.find((a) => a.system_role === "opening_balances")?.id ?? "";
  const steps = createAccountSteps(pending.draft, { openingBalances });
  const next = steps[pending.done];
  if (next === undefined) return null;

  const retry = async () => {
    setRunning(true);
    setError(null);
    let done = pending.done;
    try {
      for (const step of steps.slice(done)) {
        await step.run(api, accountId);
        done += 1;
      }
      clearPendingSetup(accountId);
      setPending(null);
      toast.show({ tone: "success", title: t("accountSetup.done") });
    } catch (caught) {
      const left = { draft: pending.draft, done };
      writePendingSetup(accountId, left);
      setPending(left);
      setError(errorText(caught, t));
    } finally {
      setRunning(false);
    }
  };

  return (
    <Alert tone="warning" live="polite">
      <AlertContent>
        <AlertTitle>
          {t("accountSetup.failed", { step: t(stepLabel[next.key]) })}
        </AlertTitle>
        <AlertDescription>
          {error ??
            t("accountSetup.remaining", { count: steps.length - pending.done })}
        </AlertDescription>
      </AlertContent>
      <AlertActions>
        <Button size="sm" loading={running} onClick={() => void retry()}>
          {t("accountSetup.retry")}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          tone="secondary"
          onClick={() => {
            clearPendingSetup(accountId);
            setPending(null);
          }}
        >
          {t("accountSetup.dismiss")}
        </Button>
      </AlertActions>
    </Alert>
  );
}
