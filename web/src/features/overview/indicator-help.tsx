import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";

import type { IndicatorKind } from "@/features/overview/indicator-figure";
import { useT } from "@/i18n/i18n-provider";

interface IndicatorHelpProps {
  kind: IndicatorKind;
}

// The note behind an indicator's help control: what the figure says, its formula and a worked
// example, one paragraph each (analytics design 5.1, V10).
export function IndicatorHelp({ kind }: IndicatorHelpProps) {
  const t = useT();

  const name = names[kind];

  return (
    <Stack gap={2}>
      <Text size="sm">{t(`overview.indicators.${name}Help`)}</Text>
      <Text size="sm">
        <Text size="sm" weight="semibold">
          {t("overview.indicators.formula")}
        </Text>{" "}
        {t(`overview.indicators.${name}Formula`)}
      </Text>
      <Text size="sm" tone="muted">
        <Text size="sm" weight="semibold">
          {t("overview.indicators.example")}
        </Text>{" "}
        {t(`overview.indicators.${name}Example`)}
      </Text>
    </Stack>
  );
}

const names = {
  savings_rate: "savings",
  liquidity: "reserve",
  committed_share: "committed",
  debt_service_share: "debt",
} as const;
