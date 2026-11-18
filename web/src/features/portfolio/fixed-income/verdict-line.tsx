import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";

import type { Verdict } from "@/features/portfolio/fixed-income/verdict";

interface VerdictLineProps {
  verdict: Verdict | null;
}

export function VerdictLine({ verdict }: VerdictLineProps) {
  if (verdict === null) return null;

  return (
    <div>
      <Stack gap={1}>
        <Text
          size="xl"
          weight="semibold"
          tone={verdict.tone === "danger" ? "danger" : "inherit"}
        >
          {verdict.line}
        </Text>
        {verdict.detail !== "" && (
          <Text size="sm" tone="muted">
            {verdict.detail}
          </Text>
        )}
      </Stack>
    </div>
  );
}
