import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";

import { useT } from "@/i18n/i18n-provider";

interface FigureHelpProps {
  help: string;
  formula: string;
  example: string;
}

// The note behind a figure's help control: what the figure says, its formula and a worked
// example, one paragraph each (analytics design 5.1, V10).
export function FigureHelp({ help, formula, example }: FigureHelpProps) {
  const t = useT();

  return (
    <Stack gap={2}>
      <Text size="sm">{help}</Text>
      <Text size="sm">
        <Text size="sm" weight="semibold">
          {t("overview.indicators.formula")}
        </Text>{" "}
        {formula}
      </Text>
      <Text size="sm" tone="muted">
        <Text size="sm" weight="semibold">
          {t("overview.indicators.example")}
        </Text>{" "}
        {example}
      </Text>
    </Stack>
  );
}
