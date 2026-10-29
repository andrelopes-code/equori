import {
  Alert,
  AlertActions,
  AlertContent,
  AlertDescription,
  AlertTitle,
} from "@slotted/react/alert";
import { Button } from "@slotted/react/button";

import type { components } from "@/api/schema.gen";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

type OpenDifference = components["schemas"]["OpenDifference"];

export type Resolution = "adjustment" | "yield" | "transactions_added";

interface OpenDifferenceAlertProps {
  open: OpenDifference;
  remains: string | null;
  // The resolution being sent, while it is in flight.
  pending: Resolution | undefined;
  scale: (code: string) => number;
  onSettle: (resolution: Resolution) => void;
}

// The difference that waits, and the three ways to close it.
export function OpenDifferenceAlert({
  open,
  remains,
  pending,
  scale,
  onSettle,
}: OpenDifferenceAlertProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();

  const amount = fmt.money(open.difference, scale(open.difference.currency));

  return (
    <Alert tone="warning">
      <AlertContent>
        <AlertTitle>
          {t("reconciliation.open", {
            amount,
            date: formatDate(open.date, locale),
          })}
        </AlertTitle>
        <AlertDescription>
          {remains ?? t("reconciliation.openHint")}
        </AlertDescription>
      </AlertContent>
      <AlertActions>
        <Button
          loading={pending === "adjustment"}
          onClick={() => {
            onSettle("adjustment");
          }}
        >
          {t("reconciliation.resolve.adjustment", { amount })}
        </Button>
        {open.difference.amount > 0 && (
          <Button
            variant="ghost"
            loading={pending === "yield"}
            onClick={() => {
              onSettle("yield");
            }}
          >
            {t("reconciliation.resolve.yield", { amount })}
          </Button>
        )}
        <Button
          variant="ghost"
          loading={pending === "transactions_added"}
          onClick={() => {
            onSettle("transactions_added");
          }}
        >
          {t("reconciliation.resolve.added")}
        </Button>
      </AlertActions>
    </Alert>
  );
}
