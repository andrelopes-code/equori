import {
  Section,
  SectionBody,
  SectionHeader,
  SectionTitle,
} from "@slotted/react/section";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";

import { BreakEvenRow } from "@/features/calculators/indexer-comparison/break-even-row";
import type { BreakEvenItem } from "@/features/calculators/indexer-comparison/break-even-items";
import type { Security } from "@/features/calculators/indexer-comparison/security";
import { securityText } from "@/features/calculators/indexer-comparison/security-text";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

interface BreakEvenListProps {
  items: readonly BreakEvenItem[];
  securities: readonly Security[];
  // The position of the reference security.
  reference: number;
}

// IC4: the break-even block, one row per floating security.
export function BreakEvenList({
  items,
  securities,
  reference,
}: BreakEvenListProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const base = securities[reference];
  if (items.length === 0 || base === undefined) return null;

  return (
    <Section>
      <SectionHeader>
        <SectionTitle>
          {t("calc.indexerComparison.breakEven.title")}
        </SectionTitle>
      </SectionHeader>

      <SectionBody>
        <Stack gap={4}>
          {items.map((item) => {
            const security = securities[item.position];

            return (
              security !== undefined && (
                <BreakEvenRow
                  key={item.position}
                  item={item}
                  security={security}
                  reference={base}
                />
              )
            );
          })}

          {base.form !== "fixed" && (
            <Text size="sm" tone="muted">
              {t("calc.indexerComparison.breakEven.floatingReference", {
                reference: securityText(base, t, locale),
              })}
            </Text>
          )}
        </Stack>
      </SectionBody>
    </Section>
  );
}
