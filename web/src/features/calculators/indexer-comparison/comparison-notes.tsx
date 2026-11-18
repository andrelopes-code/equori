import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";

import { useT } from "@/i18n/i18n-provider";

// IC14 and the limits of the comparison, as fixed text under the results.
export function ComparisonNotes() {
  const t = useT();

  return (
    <Stack gap={1}>
      <Text size="sm" tone="muted">
        {t("calc.indexerComparison.note.maturity")}
      </Text>
      <Text size="sm" tone="muted">
        {t("calc.indexerComparison.note.expected")}
      </Text>
      <Text size="sm" tone="muted">
        {t("calc.indexerComparison.note.market")}
      </Text>
      <Text size="sm" tone="muted">
        {t("calc.indexerComparison.note.credit")}
      </Text>
      <Text size="sm" tone="muted">
        {t("calc.indexerComparison.note.decision")}
      </Text>
    </Stack>
  );
}
