import { Text } from "@slotted/react/typography";

import styles from "@/features/planning/budget-plan.module.css";
import type { PlanFormat } from "@/features/planning/use-plan-format";
import { planShare } from "@/features/planning/plan-math";
import { useT } from "@/i18n/i18n-provider";

export type SegmentTone =
  | "commitment"
  | "data-1"
  | "data-2"
  | "data-3"
  | "data-4"
  | "data-5"
  | "data-6"
  | "data-7"
  | "data-8"
  | "rest"
  | "over";

export interface PlanSegment {
  key: string;
  name: string;
  amount: number;
  tone: SegmentTone;
  // The group of the table the segment stands for.
  group?: string;
}

// A segment narrower than this share of the bar shows its label on hover and focus only.
const labelShareBp = 800;

// The reference split into what pays the commitments, each group of budgets and the rest
// (spec 5.1). A segment is a button: it names its group, amount and share, lights its rows
// and opens them. Built here because the chart family draws axes and legends a part-to-whole
// line does not need, and no family draws a stacked bar of buttons.
export function PlanAllocationBar({
  segments,
  reference,
  format,
  highlighted,
  onHighlight,
  onSelect,
}: {
  segments: readonly PlanSegment[];
  reference: number;
  format: PlanFormat;
  highlighted: string | null;
  onHighlight: (group: string | null) => void;
  onSelect: (group: string) => void;
}) {
  const t = useT();
  const scale = segments.reduce((sum, s) => sum + s.amount, 0);
  return (
    <div className={styles.bar} role="group" aria-label={t("plan.bar")}>
      {segments.map((s) => {
        const share =
          format.share(planShare(s.amount, reference)) ?? t("plan.dash");
        const name = t("plan.segment", {
          name: s.name,
          amount: format.money(s.amount),
          share,
        });
        const wide = scale > 0 && (s.amount * 10000) / scale >= labelShareBp;
        const group = s.group;
        return (
          <button
            key={s.key}
            type="button"
            className={styles.segment}
            style={{ flexGrow: s.amount }}
            data-tone={s.tone}
            data-lit={
              group !== undefined && group === highlighted ? "" : undefined
            }
            aria-label={name}
            title={name}
            disabled={group === undefined}
            onMouseEnter={() => {
              onHighlight(group ?? null);
            }}
            onMouseLeave={() => {
              onHighlight(null);
            }}
            onFocus={() => {
              onHighlight(group ?? null);
            }}
            onBlur={() => {
              onHighlight(null);
            }}
            onClick={() => {
              if (group !== undefined) onSelect(group);
            }}
          >
            <span className={styles.swatch} aria-hidden="true" />
            <span
              className={styles.segmentLabel}
              aria-hidden="true"
              data-wide={wide ? "" : undefined}
            >
              <Text size="xs" weight="medium" className={styles.segmentName}>
                {s.name}
              </Text>
              <Text size="xs" tone="muted" numeric="tabular">
                {share}
              </Text>
            </span>
          </button>
        );
      })}
    </div>
  );
}
