import {
  Alert,
  AlertActions,
  AlertContent,
  AlertDescription,
} from "@slotted/react/alert";
import { Button } from "@slotted/react/button";

import type { components } from "@/api/schema.gen";
import { useCreateAccount } from "@/features/accounts";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";

type Account = components["schemas"]["Account"];

interface MissingCashNoticeProps {
  brokerage: Account;
  base: string;
}

// BC7: the brokerage has no open cash account in the base currency. The action creates it, as the
// brokerage setup does; a brokerage in another currency is offered no cash account of the base.
export function MissingCashNotice({ brokerage, base }: MissingCashNoticeProps) {
  const t = useT();
  const today = useToday();
  const create = useCreateAccount();

  function handleCreate() {
    create.mutate({
      name: t("brokerage.cashName"),
      class: "asset",
      kind: "brokerage",
      currency: base,
      opened_on: today,
      parent_id: brokerage.id,
      yield_mode: "none",
      ...(brokerage.institution_id === undefined
        ? {}
        : { institution_id: brokerage.institution_id }),
    });
  }

  return (
    <Alert tone="warning" live="polite">
      <AlertContent>
        <AlertDescription>
          {t("trade.noCash", { currency: base })}
        </AlertDescription>
      </AlertContent>
      {brokerage.currency === base && (
        <AlertActions>
          <Button
            size="sm"
            variant="outline"
            tone="secondary"
            loading={create.isPending}
            onClick={handleCreate}
          >
            {t("trade.createCash")}
          </Button>
        </AlertActions>
      )}
    </Alert>
  );
}
