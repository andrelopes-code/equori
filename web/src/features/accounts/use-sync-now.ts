import { useState } from "react";

import { errorText } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { useSyncConnection } from "@/features/accounts/api";
import { useT } from "@/i18n/i18n-provider";

type ImportCounts = components["schemas"]["ImportCounts"];

export type SyncOutcome =
  | { kind: "synced"; counts: ImportCounts }
  | { kind: "waiting"; text: string }
  | { kind: "failed"; text: string };

// Syncs a connection now and gathers what it brought into this account (A43).
export function useSyncNow(accountId: string, portal: string) {
  const t = useT();
  const sync = useSyncConnection();

  const [outcome, setOutcome] = useState<SyncOutcome | null>(null);

  function run(connectionId: string) {
    setOutcome(null);
    sync
      .mutateAsync(connectionId)
      .then((answer) => {
        if (answer.batches.length === 0) {
          setOutcome({
            kind: "waiting",
            text: t("sync.notSynced", { portal }),
          });
          return;
        }

        const mine = answer.batches.filter((b) => b.account_id === accountId);
        setOutcome({
          kind: "synced",
          counts: sumCounts(mine.map((b) => b.counts)),
        });
      })
      .catch((caught: unknown) => {
        setOutcome({ kind: "failed", text: errorText(caught, t) });
      });
  }

  return { run, pending: sync.isPending, outcome };
}

function sumCounts(all: ImportCounts[]): ImportCounts {
  const total: ImportCounts = {
    received: 0,
    ignored: 0,
    matched: 0,
    created: 0,
    needs_review: 0,
    discarded: 0,
    updated: 0,
    withdrawn: 0,
    re_identified: 0,
  };
  for (const counts of all) {
    for (const key of Object.keys(total) as (keyof ImportCounts)[]) {
      total[key] += counts[key];
    }
  }

  return total;
}
