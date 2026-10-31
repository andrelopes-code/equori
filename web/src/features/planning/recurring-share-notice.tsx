import { Highlight } from "@slotted/react/highlight";
import { Text } from "@slotted/react/typography";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { schedulesQuery } from "@/features/planning/api";
import { recurringShares } from "@/features/planning/recurring-share";
import { formatBasisPoints } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";

// One notice per currency with yearly income: the share the yearly bills and subscriptions take.
export function RecurringShareNotice() {
  const t = useT();
  const [locale] = useAppLocale();
  const api = useApi();
  const today = useToday();
  const schedules = useQuery(schedulesQuery(api));

  const shares = recurringShares(schedules.data ?? [], today);

  return shares.map((share) => {
    const percent = formatBasisPoints(share.basisPoints, locale);

    return (
      <Text key={share.currency} size="sm" tone="muted">
        <Highlight
          text={t("schedules.recurringShare", {
            percent,
            currency: share.currency,
          })}
          query={percent}
          occurrences="first"
        />
      </Text>
    );
  });
}
