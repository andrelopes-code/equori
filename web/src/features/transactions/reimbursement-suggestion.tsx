import {
  Alert,
  AlertActions,
  AlertContent,
  AlertDescription,
} from "@slotted/react/alert";
import { Button } from "@slotted/react/button";
import { toast } from "@slotted/react/toast";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import {
  reimbursementCandidatesQuery,
  useReimburseTransaction,
} from "@/features/transactions/api";
import { reimbursementState } from "@/features/transactions/reimbursement";
import { reimbursementErrorText } from "@/features/transactions/reimbursement-error";
import { useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

type Account = components["schemas"]["Account"];
type Transaction = components["schemas"]["Transaction"];

// An uncategorized inflow with expenses it may repay. When one combination of them adds up to
// the amount received, the prompt names it and one click confirms it; otherwise it only asks (A117).
export function ReimbursementSuggestion({
  transaction,
  accounts,
  scale,
  onChooseAnother,
}: {
  transaction: Transaction;
  accounts: ReadonlyMap<string, Account>;
  scale: (code: string) => number;
  onChooseAnother: () => void;
}) {
  const t = useT();
  const fmt = useMoneyFormat();
  const api = useApi();
  const reimburse = useReimburseTransaction();
  const [error, setError] = useState<string | null>(null);
  const state = reimbursementState(transaction, accounts);
  const eligible =
    state.inflow && state.uncategorized && transaction.voided_at === undefined;
  const candidates = useQuery({
    ...reimbursementCandidatesQuery(api, transaction.id),
    enabled: eligible,
  });
  const items = candidates.data?.items ?? [];
  if (!eligible || items.length === 0) return null;
  const suggested = (candidates.data?.suggestion ?? []).flatMap((id) => {
    const found = items.find((item) => item.transaction.id === id);
    return found === undefined ? [] : [found];
  });
  const named = suggested.map((item) =>
    t("reimbursement.item", {
      description: item.transaction.description,
      amount: fmt.money(item.remaining, scale(item.remaining.currency)),
    }),
  );
  return (
    <Alert tone={suggested.length > 0 ? "accent" : "secondary"} reach="section">
      <AlertContent>
        <AlertDescription>
          {suggested.length > 0
            ? t("reimbursement.suggestion", { items: named.join(" + ") })
            : t("reimbursement.prompt")}
        </AlertDescription>
        {error !== null && <AlertDescription>{error}</AlertDescription>}
      </AlertContent>
      <AlertActions>
        {suggested.length > 0 ? (
          <>
            <Button
              loading={reimburse.isPending}
              onClick={() => {
                setError(null);
                reimburse
                  .mutateAsync({
                    current: transaction,
                    allocations: suggested.map((item) => ({
                      original_id: item.transaction.id,
                      amount: item.remaining,
                    })),
                  })
                  .then(() => {
                    toast.show({
                      tone: "success",
                      title: t("reimbursement.done"),
                    });
                  })
                  .catch((caught: unknown) => {
                    setError(reimbursementErrorText(caught, t));
                  });
              }}
            >
              {t("reimbursement.confirm")}
            </Button>
            <Button variant="ghost" onClick={onChooseAnother}>
              {t("reimbursement.other")}
            </Button>
          </>
        ) : (
          <Button onClick={onChooseAnother}>{t("reimbursement.match")}</Button>
        )}
      </AlertActions>
    </Alert>
  );
}
