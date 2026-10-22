import { Stack } from "@slotted/react/stack";
import { Tag } from "@slotted/react/tag";
import { Text } from "@slotted/react/typography";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { scheduleQuery } from "@/features/accounts/api";
import type { MessageKey } from "@/i18n/catalog.en";
import { useT } from "@/i18n/i18n-provider";

type ProjectionPoint = components["schemas"]["ProjectionPoint"];

const kindLabel: Record<components["schemas"]["ScheduleKind"], MessageKey> = {
  bill: "scheduled.kind.bill",
  income: "scheduled.kind.income",
  subscription: "scheduled.kind.subscription",
  transfer: "scheduled.kind.transfer",
  savings: "scheduled.kind.savings",
};

// The schedule an expected entry comes from, read once per schedule.
export function ScheduleCell({ point }: { point: ProjectionPoint }) {
  const t = useT();
  const schedule = useQuery(scheduleQuery(useApi(), point.schedule_id));
  if (schedule.data === undefined)
    return <Text size="sm">{t("scheduled.loading")}</Text>;
  return (
    <Stack gap={0}>
      <Text size="sm" weight="medium">
        {schedule.data.description === ""
          ? t("ledger.untitled")
          : schedule.data.description}
      </Text>
      <span>
        <Tag size="sm" tone="secondary">
          {t(kindLabel[schedule.data.kind])}
        </Tag>
      </span>
    </Stack>
  );
}
