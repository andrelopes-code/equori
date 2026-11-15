import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";

import { EndedSubscriptions } from "@/features/planning/subscriptions/ended-subscriptions";
import { NextCharges } from "@/features/planning/subscriptions/next-charges";
import { PriceChanges } from "@/features/planning/subscriptions/price-changes";
import { RankingTable } from "@/features/planning/subscriptions/ranking-table";
import styles from "@/features/planning/subscriptions/subscriptions.module.css";
import { SubscriptionsSummary } from "@/features/planning/subscriptions/subscriptions-summary";
import { useSubscriptionsData } from "@/features/planning/subscriptions/use-subscriptions-data";
import { useT } from "@/i18n/i18n-provider";
import { QueryError } from "@/ui/feedback/query-error";

const legend = ["paid", "other", "skipped"] as const;

// What the subscriptions cost, which weigh most, how each charged over the last 12 months and
// which prices change (docs/specs/2026-11-15-planning-tabs-design.md, section 6).
export function SubscriptionsTab() {
  const t = useT();
  const data = useSubscriptionsData();

  const scale = data.scale ?? (() => 0);

  if (data.schedules.isError)
    return (
      <QueryError
        error={data.schedules.error}
        onRetry={() => void data.schedules.refetch()}
      />
    );

  return (
    <Stack gap={6}>
      <SubscriptionsSummary
        figures={data.figures}
        scale={data.scale}
        loading={data.loading}
      />

      <div className={styles.columns}>
        <div className={styles.column}>
          <RankingTable
            lines={data.figures?.active ?? []}
            accountNames={data.accountNames}
            scale={scale}
            loading={data.loading}
          />
          <div className={styles.legend} aria-hidden="true">
            {legend.map((state) => (
              <span key={state} className={styles.key}>
                <i className={styles.cell} data-state={state} />
                <Text size="xs" tone="muted">
                  {t(`subscriptions.legend.${state}`)}
                </Text>
              </span>
            ))}
          </div>
        </div>

        <div className={styles.column}>
          <PriceChanges changes={data.figures?.changes ?? []} scale={scale} />
          <NextCharges charges={data.figures?.next ?? []} scale={scale} />
          <EndedSubscriptions lines={data.figures?.ended ?? []} scale={scale} />
        </div>
      </div>
    </Stack>
  );
}
