import { useState } from "react";

import { errorText } from "@/api/problem";
import { useSyncConnection } from "@/features/accounts/api";
import { useT } from "@/i18n/i18n-provider";

// Syncs a connection now and words what it brought into this account (A43).
export function useSyncNow(accountId: string, portal: string) {
  const t = useT();
  const sync = useSyncConnection();

  const [result, setResult] = useState<string | null>(null);

  function run(connectionId: string) {
    setResult(null);
    sync
      .mutateAsync(connectionId)
      .then((answer) => {
        const mine = answer.batches.filter((b) => b.account_id === accountId);
        const created = mine.reduce((s, b) => s + b.counts.created, 0);
        const matched = mine.reduce((s, b) => s + b.counts.matched, 0);
        setResult(
          answer.batches.length === 0
            ? t("sync.notSynced", { portal })
            : t("sync.result", { created, matched }),
        );
      })
      .catch((caught: unknown) => {
        setResult(errorText(caught, t));
      });
  }

  return { run, pending: sync.isPending, result };
}
