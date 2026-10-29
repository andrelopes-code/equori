import {
  Alert,
  AlertActions,
  AlertContent,
  AlertDescription,
} from "@slotted/react/alert";
import { Link } from "@slotted/react/link";

import type { AssertionOutcome } from "@/features/accounts/assertion-result";
import type { MessageKey } from "@/i18n/catalog.en";
import { useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { routeTo } from "@/ui/route-to";

const outcomeLabel: Record<AssertionOutcome["kind"], MessageKey> = {
  reconciled: "reconciliation.result.reconciled",
  yield: "reconciliation.result.yield",
  adjustment: "reconciliation.result.adjustment",
  added: "reconciliation.result.added",
  open: "reconciliation.result.open",
};

interface AssertionOutcomeAlertProps {
  outcome: AssertionOutcome;
  scale: (code: string) => number;
}

// What the last comparison or resolution did, with the transaction it recorded.
export function AssertionOutcomeAlert({
  outcome,
  scale,
}: AssertionOutcomeAlertProps) {
  const t = useT();
  const fmt = useMoneyFormat();

  return (
    <Alert tone={outcome.kind === "open" ? "warning" : "success"} live="polite">
      <AlertContent>
        <AlertDescription>
          {t(outcomeLabel[outcome.kind], {
            amount: fmt.money(
              outcome.difference,
              scale(outcome.difference.currency),
            ),
          })}
        </AlertDescription>
      </AlertContent>
      {outcome.transactionId !== undefined && (
        <AlertActions>
          <Link
            render={routeTo({
              to: "/transactions/$id",
              params: { id: outcome.transactionId },
            })}
          >
            {t("reconciliation.viewTransaction")}
          </Link>
        </AlertActions>
      )}
    </Alert>
  );
}
