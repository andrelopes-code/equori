import {
  Alert,
  AlertActions,
  AlertContent,
  AlertDescription,
} from "@slotted/react/alert";
import { Button } from "@slotted/react/button";

import type { components } from "@/api/schema.gen";
import {
  nextExpectedOn,
  realizedActuals,
  suggestTermsAmount,
} from "@/features/planning/terms-suggestion";
import { useScale } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

type Occurrence = components["schemas"]["Occurrence"];
type ScheduleTerms = components["schemas"]["ScheduleTerms"];

interface TermsSuggestionBannerProps {
  terms: ScheduleTerms;
  occurrences: readonly Occurrence[];
  onUpdate: (amount: number, effectiveFrom: string | undefined) => void;
}

// Offers the median of the last 3 received amounts as the new expected amount when they drift
// from the current one. The terms dialog confirms; nothing is written here.
export function TermsSuggestionBanner({
  terms,
  occurrences,
  onUpdate,
}: TermsSuggestionBannerProps) {
  const t = useT();
  const fmt = useMoneyFormat();
  const scale = useScale();
  const amount = suggestTermsAmount(
    terms.amount.amount,
    realizedActuals(occurrences),
  );
  if (amount === null || scale === null) return null;

  const { currency } = terms.amount;

  return (
    <Alert actionsPlacement="end">
      <AlertContent>
        <AlertDescription>
          {t("schedule.drift.title", {
            amount: fmt.money({ amount, currency }, scale(currency)),
          })}
        </AlertDescription>
      </AlertContent>
      <AlertActions>
        <Button
          onClick={() => {
            onUpdate(amount, nextExpectedOn(occurrences));
          }}
        >
          {t("schedule.drift.action")}
        </Button>
      </AlertActions>
    </Alert>
  );
}
