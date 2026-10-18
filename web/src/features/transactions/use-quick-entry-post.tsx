import { Button } from "@slotted/react/button";
import { toast } from "@slotted/react/toast";

import { ProblemError, problemMessage } from "@/api/problem";
import {
  useCreateTransaction,
  useVoidTransaction,
} from "@/features/transactions/api";
import type { FormState } from "@/features/transactions/transaction-form-reducer";
import { useT } from "@/i18n/i18n-provider";

// Complete frontend F2: posts the entry, then offers Undo for five seconds, which voids it.
export function useQuickEntryPost() {
  const t = useT();
  const create = useCreateTransaction();
  const voidTransaction = useVoidTransaction();
  const post = async (
    state: FormState,
    currencyOf: (accountId: string) => string,
    done: string,
  ): Promise<boolean> => {
    try {
      const created = await create.mutateAsync({ state, currencyOf });
      const toastID = `posted-${created.id}`;
      toast.show({
        id: toastID,
        title: done,
        duration: 5000,
        actions: (
          <Button
            tone="secondary"
            variant="outline"
            size="sm"
            onClick={() => {
              toast.dismiss(toastID);
              voidTransaction.mutate(
                { current: created, reason: t("entry.undo.reason") },
                {
                  onError: () => {
                    toast.show({ title: t("entry.failed"), tone: "danger" });
                  },
                },
              );
            }}
          >
            {t("entry.undo")}
          </Button>
        ),
      });
      return true;
    } catch (failure) {
      toast.show({
        title:
          failure instanceof ProblemError
            ? problemMessage(failure.problem, t)
            : t("entry.failed"),
        tone: "danger",
      });
      return false;
    }
  };
  return { post, pending: create.isPending };
}
