import { DetailPanelSection } from "@slotted/react/detail-panel";
import { Inline } from "@slotted/react/inline";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import {
  schedulesQuery,
  transactionOccurrencesQuery,
} from "@/features/planning/api";
import { OccurrenceActions } from "@/features/planning/occurrence-actions";
import { useScale } from "@/features/setup";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

type Transaction = components["schemas"]["Transaction"];

// The occurrences the transaction realized, each with its unrealize action; nothing when it
// realized none.
export function RealizedOccurrences({
  transaction,
}: {
  transaction: Transaction;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const api = useApi();
  const fmt = useMoneyFormat();
  const scale = useScale();
  const occurrences = useQuery(
    transactionOccurrencesQuery(api, transaction.id),
  );
  const schedules = useQuery(schedulesQuery(api));
  const realized = occurrences.data ?? [];
  if (realized.length === 0 || scale === null) return null;
  const names = new Map(
    (schedules.data ?? []).map((s) => [s.id, s.description]),
  );
  return (
    <DetailPanelSection name="occurrences" label={t("detail.occurrences")}>
      <Stack gap={2}>
        {realized.map((o) => {
          const description = names.get(o.schedule_id) ?? "";
          const name = description === "" ? t("ledger.untitled") : description;
          return (
            <Inline key={o.id} gap={3} justify="between" align="center">
              <Stack gap={0}>
                <Text size="sm" weight="medium">
                  {name}
                </Text>
                <Text size="sm" tone="muted">
                  {t("detail.occurrenceOf", {
                    date: formatDate(o.expected_on, locale),
                    amount: fmt.money(
                      o.expected_amount,
                      scale(o.expected_amount.currency),
                    ),
                  })}
                </Text>
              </Stack>
              <OccurrenceActions occurrence={o} name={name} />
            </Inline>
          );
        })}
      </Stack>
    </DetailPanelSection>
  );
}
