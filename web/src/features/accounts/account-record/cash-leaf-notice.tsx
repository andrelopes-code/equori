import {
  Alert,
  AlertActions,
  AlertContent,
  AlertDescription,
} from "@slotted/react/alert";
import { ButtonLink } from "@slotted/react/button";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { accountsQuery } from "@/features/accounts/api";
import { isCashLeafNamedAfterInstrument } from "@/features/accounts/model/cash-leaf";
import { instrumentsQuery } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";
import { routeTo } from "@/ui/navigation/route-to";

type Account = components["schemas"]["Account"];

interface CashLeafNoticeProps {
  account: Account;
}

// BC10: the page of a cash account named after an investment says what the account is and opens
// the purchase form with its brokerage.
export function CashLeafNotice({ account }: CashLeafNoticeProps) {
  const t = useT();
  const api = useApi();
  const accounts = useQuery(accountsQuery(api));
  const instruments = useQuery(instrumentsQuery(api));

  if (
    accounts.data === undefined ||
    instruments.data === undefined ||
    !isCashLeafNamedAfterInstrument(
      account,
      accounts.data,
      instruments.data.items,
    )
  ) {
    return null;
  }

  return (
    <Alert tone="info" live="polite">
      <AlertContent>
        <AlertDescription>{t("brokerage.cashLeafNotice")}</AlertDescription>
      </AlertContent>
      <AlertActions>
        <ButtonLink
          render={routeTo({
            to: "/transactions/new",
            search: {
              kind: "trade",
              brokerage_id: account.parent_id ?? account.id,
            },
          })}
        >
          {t("positions.recordBuy")}
        </ButtonLink>
      </AlertActions>
    </Alert>
  );
}
