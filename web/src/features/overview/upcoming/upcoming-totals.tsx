import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import styles from "@/features/overview/upcoming/upcoming.module.css";
import { UpcomingTotal } from "@/features/overview/upcoming/upcoming-total";
import { useT } from "@/i18n/i18n-provider";

type Money = components["schemas"]["Money"];

interface UpcomingTotalsProps {
  leaving: readonly Money[];
  entering: readonly Money[];
  scale: (currency: string) => number;
}

// What leaves and what enters in the listed rows, one amount per currency (UP6). It stands in
// the widget's footer, so it stays in sight while the rows scroll.
export function UpcomingTotals({
  leaving,
  entering,
  scale,
}: UpcomingTotalsProps) {
  const t = useT();

  if (leaving.length === 0 && entering.length === 0) return null;

  return (
    <div className={styles.totals} data-part="totals">
      {leaving.length > 0 && (
        <span className={styles.total}>
          <Text size="sm" tone="muted">
            {t("overview.upcoming.leaving")}
          </Text>
          <Text size="sm" weight="semibold" numeric="tabular">
            <UpcomingTotal amounts={leaving} scale={scale} />
          </Text>
        </span>
      )}

      {entering.length > 0 && (
        <span className={styles.total}>
          <Text size="sm" tone="muted">
            {t("overview.upcoming.entering")}
          </Text>
          <Text size="sm" weight="semibold" numeric="tabular" tone="success">
            <UpcomingTotal amounts={entering} scale={scale} />
          </Text>
        </span>
      )}
    </div>
  );
}
