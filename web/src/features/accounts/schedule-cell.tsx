import { Stack } from "@slotted/react/stack";
import { Tag } from "@slotted/react/tag";
import { Text } from "@slotted/react/typography";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { kindLabel, scheduleQuery } from "@/features/planning";
import { useT } from "@/i18n/i18n-provider";

type ProjectionPoint = components["schemas"]["ProjectionPoint"];

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
