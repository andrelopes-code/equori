import {
  Alert,
  AlertActions,
  AlertContent,
  AlertDescription,
} from "@slotted/react/alert";
import { ButtonLink } from "@slotted/react/button";
import { Link } from "@tanstack/react-router";

import type { components } from "@/api/schema.gen";
import { useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

type Account = components["schemas"]["Account"];

interface ShortfallNoticeProps {
  payer: Account;
  // Minor units of the base currency.
  amount: number;
  scale: number;
}

// BC8: the cash balance does not cover the purchase. The save stays enabled; the server decides.
export function ShortfallNotice({
  payer,
  amount,
  scale,
}: ShortfallNoticeProps) {
  const t = useT();
  const fmt = useMoneyFormat();

  return (
    <Alert tone="warning" live="polite">
      <AlertContent>
        <AlertDescription>
          {t("trade.shortfall", {
            amount: fmt.money({ amount, currency: payer.currency }, scale),
          })}
        </AlertDescription>
      </AlertContent>
      <AlertActions>
        <ButtonLink
          size="sm"
          variant="outline"
          tone="secondary"
          render={(props) => (
            <Link
              {...props}
              to="/transactions/new"
              search={{ kind: "transfer", to_account_id: payer.id }}
            />
          )}
        >
          {t("trade.moveMoney", { name: payer.name })}
        </ButtonLink>
      </AlertActions>
    </Alert>
  );
}
