import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import styles from "@/features/portfolio/contribution-plan/strip/contribution-strip.module.css";
import { StripFigure } from "@/features/portfolio/contribution-plan/strip/strip-figure";
import { useScale } from "@/features/setup";
import { numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { MoneyInput } from "@/ui/money/money-input";

type Plan = components["schemas"]["ContributionPlan"];

interface ContributionStripProps {
  view: Plan;
  amount: number;
  pending: boolean;
  onAmount: (minor: number) => void;
}

// The amount of the contribution, the portfolio before and after it, and the drift it causes.
export function ContributionStrip({
  view,
  amount,
  pending,
  onAmount,
}: ContributionStripProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const scale = useScale();

  const currency = view.total.currency;
  const points = (bp: number) =>
    t("contributionPlan.points", {
      value: numberFormatter(tag, { maximumFractionDigits: 1 }).format(
        bp / 100,
      ),
    });

  return (
    <div className={styles.strip} aria-busy={pending}>
      <div className={styles.amount}>
        <Text size="xs" tone="muted">
          {t("contributionPlan.amount")}
        </Text>

        <MoneyInput
          size="field"
          value={amount}
          onChange={onAmount}
          currency={currency}
          scale={scale?.(currency) ?? 0}
          sign="neutral"
          aria-label={t("contributionPlan.amount")}
        />
      </div>

      <Text size="sm" className={styles.drift}>
        {view.drift_bp !== undefined &&
          view.drift_after_bp !== undefined &&
          t("contributionPlan.driftMoves", {
            before: points(view.drift_bp),
            after: points(view.drift_after_bp),
          })}

        {view.drift_bp !== undefined &&
          view.drift_after_bp === undefined &&
          t("contributionPlan.driftNow", { drift: points(view.drift_bp) })}
      </Text>

      <StripFigure label={t("contributionPlan.total")} value={view.total} />

      {view.total_after !== undefined && (
        <StripFigure
          label={t("contributionPlan.totalAfter")}
          value={view.total_after}
        />
      )}
    </div>
  );
}
