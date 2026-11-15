import { Card, CardBody, CardHeader } from "@slotted/react/card";
import { Skeleton } from "@slotted/react/skeleton";
import { Heading, Text } from "@slotted/react/typography";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { budgetBucketHistoryQuery } from "@/features/planning/api";
import {
  trackMonth,
  trackVerdict,
} from "@/features/planning/income-split/bucket-history";
import { BucketTrackLegend } from "@/features/planning/income-split/bucket-track-legend";
import { BucketTrackRow } from "@/features/planning/income-split/bucket-track-row";
import styles from "@/features/planning/income-split/bucket-track.module.css";
import { useMonthNames } from "@/features/planning/income-split/use-month-names";
import { useShareText } from "@/features/planning/income-split/use-share-text";
import { useScale } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { QueryError } from "@/ui/feedback/query-error";

interface BucketTrackProps {
  month: string;
}

// Whether each bucket of the income split kept to its target in month, and in the five months
// before (income buckets spec 5, Track): the sentence first, then one line per bucket. Draws
// nothing while the book has no split.
export function BucketTrack({ month }: BucketTrackProps) {
  const t = useT();
  const api = useApi();
  const history = useQuery(budgetBucketHistoryQuery(api, month));
  const scale = useScale();
  const fmt = useMoneyFormat();
  const share = useShareText();
  const names = useMonthNames(history.data?.months.map((m) => m.month) ?? []);

  if (history.isError)
    return (
      <QueryError
        error={history.error}
        onRetry={() => void history.refetch()}
      />
    );
  if (history.data === undefined || scale === null)
    return <Skeleton shape="block" blockSize="18rem" />;
  if (history.data.buckets.length === 0) return null;

  const currency = history.data.currency;
  const money = (amount: number) =>
    fmt.money({ amount, currency }, scale(currency));
  const track = trackMonth(history.data, month);
  const verdict = trackVerdict(track);
  const monthName = names.long(month);
  const outside =
    history.data.months.find((m) => m.month === month)?.outside.amount ?? 0;

  return (
    <Card>
      <CardHeader>
        <Heading level={2} size="sm">
          {t("buckets.title")}
        </Heading>
        <Text size="md" weight="medium">
          {t(verdict.key, {
            month: monthName,
            count: "count" in verdict ? String(verdict.count) : "",
            total: String(track.rows.length),
          })}
        </Text>
        {track.received > 0 && (
          <Text size="sm" tone="muted">
            {t("track.received", { amount: money(track.received) })}
          </Text>
        )}
      </CardHeader>

      <CardBody>
        <div className={styles.rows}>
          {track.rows.map((row) => (
            <BucketTrackRow
              key={row.id}
              row={row}
              month={month}
              monthNames={names.short}
              money={money}
              share={share}
            />
          ))}
        </div>
        {outside > 0 && (
          <Text size="sm" tone="muted">
            {t("track.outside", { amount: money(outside), month: monthName })}
          </Text>
        )}
        <BucketTrackLegend />
      </CardBody>
    </Card>
  );
}
