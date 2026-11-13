import { Link } from "@slotted/react/link";
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
  // Set for a group whose units wait for a split among its assets: the link enters edit mode.
  onSplit?: () => void;
}

// The outcome column of a row: what it costs this month, that it receives nothing, or nothing
// without an amount.
export function EntryOutcome({
  amount,
  hasAmount,
  waiting,
  onSplit,
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

      {!waiting && hasAmount && positive(amount) && onSplit !== undefined && (
        <Text size="sm">
          <Link
            href="#"
            onClick={(event) => {
              event.preventDefault();
              onSplit();
            }}
          >
            {t("contributionPlan.splitToSee")}
          </Link>
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
          {t("contributionPlan.outcomeNone")}
        </Text>
      )}
    </div>
  );
}
