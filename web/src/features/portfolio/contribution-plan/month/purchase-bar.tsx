import { Inline } from "@slotted/react/inline";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";

import styles from "@/features/portfolio/contribution-plan/month/purchase-bar.module.css";
import { numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

export interface PurchaseSegment {
  key: string;
  // The position of the group; the leftover has none and is hatched.
  group?: number;
  // The minor units of the cost: the segment's width in proportion to the others.
  amount: number;
  // "PETR4 50%": the segment in the bar's accessible name.
  label: string;
}

interface PurchaseBarProps {
  segments: PurchaseSegment[];
  // The contribution, written at the end of the scale.
  total: string;
  // The key of the row under the pointer.
  active?: string | undefined;
}

const paletteSize = 8;

// Build-own-element (spec, Purchase list as one bar): ProgressIndicator draws one value, Chart
// draws axes and a legend of its own, and neither marks the segment of a row the pointer is on.
// Workaround for Slotted issue #119: no family draws one bar split into parts linked to rows.
export function PurchaseBar({ segments, total, active }: PurchaseBarProps) {
  const t = useT();
  const [locale] = useAppLocale();

  const zero = numberFormatter(locale).format(0);
  const parts = new Intl.ListFormat(locale, { type: "conjunction" }).format(
    segments.map((s) => s.label),
  );

  return (
    <Stack gap={2}>
      <div
        role="img"
        aria-label={t("contributionPlan.purchaseBarLabel", { parts })}
        className={styles.bar}
        data-active={active !== undefined}
      >
        {segments.map((s) => (
          <span
            key={s.key}
            className={[styles.segment, fillOf(s.group)].join(" ")}
            data-current={s.key === active}
            style={{ flexGrow: s.amount }}
          />
        ))}
      </div>

      <Inline justify="between" wrap="nowrap">
        <Text size="xs" tone="muted">
          {zero}
        </Text>

        <Text size="xs" tone="muted">
          {total}
        </Text>
      </Inline>
    </Stack>
  );
}

function fillOf(group: number | undefined): string {
  if (group === undefined) return styles.hatch ?? "";

  return styles[`slot${String((group % paletteSize) + 1)}`] ?? "";
}
