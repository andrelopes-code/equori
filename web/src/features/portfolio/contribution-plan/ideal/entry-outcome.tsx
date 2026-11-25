import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import styles from "@/features/portfolio/contribution-plan/ideal/ideal-grid.module.css";
import { positive } from "@/features/portfolio/contribution-plan/model/shopping-list";
import { useScale } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

type Money = components["schemas"]["Money"];

interface EntryOutcomeProps {
  amount: Money | undefined;
  // Whether the plan holds a contribution amount.
  hasAmount: boolean;
  // Whether a missing price stops the split (CN10).
  waiting: boolean;
  // Whether a criterion holds the purchase this month (CO6).
  held: boolean;
}

// The outcome column of a row: what it costs this month, that it receives nothing, or nothing
// without an amount.
export function EntryOutcome({
  amount,
  hasAmount,
  waiting,
  held,
}: EntryOutcomeProps) {
  const t = useT();
  const fmt = useMoneyFormat();
  const scale = useScale();

  return (
    <div className={styles.outcome}>
      {waiting && (
        <Text size="sm" tone="muted">
          {t("contributionPlan.outcomeWaits")}
        </Text>
      )}

      {!waiting && hasAmount && positive(amount) && (
        <Text weight="semibold">
          {t("contributionPlan.outcomeReceives", {
            amount: fmt.money(amount, scale?.(amount.currency) ?? 0),
          })}
        </Text>
      )}

      {!waiting && hasAmount && !positive(amount) && (
        <Text size="sm" tone="muted">
          {t(
            held
              ? "contributionPlan.list.waits"
              : "contributionPlan.outcomeNone",
          )}
        </Text>
      )}
    </div>
  );
}
