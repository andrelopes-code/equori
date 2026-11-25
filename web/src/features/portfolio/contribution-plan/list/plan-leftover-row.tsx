import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import styles from "@/features/portfolio/contribution-plan/list/plan-list.module.css";
import { GroupDot } from "@/features/portfolio/contribution-plan/month/group-dot";
import { shareText } from "@/features/portfolio/contribution-plan/model/share-text";
import { useScale } from "@/features/setup";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { cx } from "@/ui/cx";

type Money = components["schemas"]["Money"];

interface PlanLeftoverRowProps {
  amount: Money;
  // The contribution in minor units: the base of the share.
  base: number;
}

// The money CN18 leaves unspent, as the last row of the purchases.
export function PlanLeftoverRow({ amount, base }: PlanLeftoverRowProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  const scale = useScale();

  return (
    <li className={styles.item}>
      <div className={cx(styles.row, styles.still)}>
        <span className={styles.square}>
          <GroupDot shape="square" />
        </span>

        <Text size="md" weight="medium" className={styles.code}>
          {t("contributionPlan.leftoverName")}
        </Text>

        <Text size="xs" tone="muted" className={styles.group}>
          {t("contributionPlan.leftoverStays")}
        </Text>

        <Text size="md" weight="semibold" className={styles.total}>
          {fmt.money(amount, scale?.(amount.currency) ?? 0)}
        </Text>

        <Text size="xs" tone="muted" className={styles.tail}>
          {shareText(amount.amount / base, locale)}
        </Text>
      </div>
    </li>
  );
}
