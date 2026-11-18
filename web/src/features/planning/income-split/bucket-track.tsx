import {
  Section,
  SectionActions,
  SectionBody,
  SectionDescription,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";
import { Skeleton } from "@slotted/react/skeleton";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { accountsQuery } from "@/features/accounts";
import { useCategoryEntries } from "@/features/categories";
import {
  budgetBucketHistoryQuery,
  budgetBucketVersionsQuery,
  budgetPlanQuery,
} from "@/features/planning/api";
import {
  trackMonth,
  trackVerdict,
} from "@/features/planning/income-split/bucket-history";
import { BucketEntriesDrawer } from "@/features/planning/income-split/entries/bucket-entries-drawer";
import { BucketHistoryAction } from "@/features/planning/income-split/versions/bucket-history-action";
import { BucketTrackLegend } from "@/features/planning/income-split/bucket-track-legend";
import { BucketTrackNotes } from "@/features/planning/income-split/bucket-track-notes";
import { BucketTrackRow } from "@/features/planning/income-split/bucket-track-row";
import styles from "@/features/planning/income-split/bucket-track.module.css";
import { TrackStrip } from "@/features/planning/income-split/track-strip";
import { trackStrip } from "@/features/planning/income-split/track-strip-parts";
import { useBucketEntries } from "@/features/planning/income-split/entries/use-bucket-entries";
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
  const plan = useQuery(budgetPlanQuery(api, month));
  const versions = useQuery(budgetBucketVersionsQuery(api));
  const accounts = useQuery(accountsQuery(api));
  const entries = useCategoryEntries(accounts.data);
  const scale = useScale();
  const fmt = useMoneyFormat();
  const share = useShareText();
  const drawer = useBucketEntries();
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

  const currency = history.data.currency;
  const money = (amount: number) =>
    fmt.money({ amount, currency }, scale(currency));
  const track = trackMonth(
    history.data,
    month,
    versions.data?.versions[0]?.from,
  );
  if (track.rows.length === 0) return null;
  const verdict = trackVerdict(track);
  const reference = plan.data?.reference?.amount;
  const monthName = names.long(month);
  const outside =
    history.data.months.find((m) => m.month === month)?.outside.amount ?? 0;

  return (
    <Section size="lg" ground="surface">
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>{t("buckets.title")}</SectionHeading>
          {track.received > 0 && (
            <SectionDescription>
              {t("track.received", { amount: money(track.received) })}
            </SectionDescription>
          )}
        </SectionTitle>
        <SectionActions>
          <BucketHistoryAction month={month} entries={entries} />
        </SectionActions>
      </SectionHeader>

      <SectionBody>
        <Stack gap={5}>
          <Stack gap={1}>
            <Text size="md" weight="medium">
              {t(verdict.key, {
                month: monthName,
                count: "count" in verdict ? String(verdict.count) : "",
                total: String(track.rows.length),
              })}
            </Text>
            {track.since !== undefined && versions.data !== undefined && (
              <Text size="sm" tone="muted">
                {track.since.first
                  ? t("track.sinceStart")
                  : t("track.since", {
                      month: names.longYear(track.since.from),
                    })}
              </Text>
            )}

            {reference !== undefined &&
              track.received > 0 &&
              reference !== track.received && (
                <Text size="sm" tone="muted">
                  {t("track.referenceDiffers", {
                    received: money(track.received),
                    reference: money(reference),
                  })}
                </Text>
              )}
          </Stack>

          <TrackStrip
            parts={trackStrip(history.data, month)}
            received={money(track.received)}
            money={money}
          />

          <div className={styles.rows}>
            {track.rows.map((row) => (
              <BucketTrackRow
                key={row.id}
                row={row}
                received={track.received}
                month={month}
                monthNames={names.short}
                money={money}
                share={share}
                onOpen={(id) => {
                  drawer.open(id, month);
                }}
              />
            ))}
          </div>

          <BucketTrackNotes
            outside={outside}
            retained={track.retained}
            unallocated={track.unallocated}
            month={monthName}
            money={money}
            onOutside={() => {
              drawer.open("outside", month);
            }}
          />

          <BucketTrackLegend
            changed={track.rows.some((r) => r.months.some((c) => c.changed))}
          />
        </Stack>
      </SectionBody>

      {drawer.target !== undefined && (
        <BucketEntriesDrawer
          target={drawer.target}
          rows={track.rows}
          months={history.data.months.map((m) => m.month)}
          categories={entries}
          money={money}
          onMonth={drawer.setMonth}
          onClose={drawer.close}
        />
      )}
    </Section>
  );
}
