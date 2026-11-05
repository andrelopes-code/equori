import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";

import { useT } from "@/i18n/i18n-provider";

// The note behind the spending pace's help control, laid out as an indicator's note.
export function SpendingPaceHelp() {
  const t = useT();

  return (
    <Stack gap={2}>
      <Text size="sm">{t("overview.pace.help")}</Text>
      <Text size="sm">
        <Text size="sm" weight="semibold">
          {t("overview.indicators.formula")}
        </Text>{" "}
        {t("overview.pace.formula")}
      </Text>
      <Text size="sm" tone="muted">
        <Text size="sm" weight="semibold">
          {t("overview.indicators.example")}
        </Text>{" "}
        {t("overview.pace.example")}
      </Text>
    </Stack>
  );
}
