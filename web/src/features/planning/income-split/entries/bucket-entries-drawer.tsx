import {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerHeader,
  DrawerPanel,
  DrawerTitle,
} from "@slotted/react/drawer";
import { Skeleton } from "@slotted/react/skeleton";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import type { CategoryEntry } from "@/features/categories";
import { budgetBucketEntriesQuery } from "@/features/planning/api";
import { BucketEntriesSummary } from "@/features/planning/income-split/entries/bucket-entries-summary";
import { entryGroups } from "@/features/planning/income-split/entries/bucket-entries";
import { BucketEntryGroup } from "@/features/planning/income-split/entries/bucket-entry-group";
import type { TrackRow } from "@/features/planning/income-split/bucket-history";
import type { EntriesTarget } from "@/features/planning/income-split/entries/use-bucket-entries";
import { useMonthNames } from "@/features/planning/income-split/use-month-names";
import { useT } from "@/i18n/i18n-provider";
import { ChoiceSelect } from "@/ui/form-fields/choice-select";
import { QueryError } from "@/ui/feedback/query-error";

interface BucketEntriesDrawerProps {
  target: EntriesTarget;
  rows: readonly TrackRow[];
  // The months of the history window, oldest first.
  months: readonly string[];
  categories: readonly CategoryEntry[];
  money: (amount: number) => string;
  onMonth: (month: string) => void;
  onClose: () => void;
}

// What counted in one bucket, or outside the split, in one month: the month, the summary, then
// the entries by category.
export function BucketEntriesDrawer({
  target,
  rows,
  months,
  categories,
  money,
  onMonth,
  onClose,
}: BucketEntriesDrawerProps) {
  const t = useT();
  const api = useApi();
  const outside = target.bucket === "outside";
  const entries = useQuery(
    budgetBucketEntriesQuery(
      api,
      target.month,
      outside ? undefined : target.bucket,
    ),
  );
  const names = useMonthNames(months);
  const row = rows.find((r) => r.id === target.bucket);
  const cell = row?.months.find((c) => c.month === target.month);
  const choices = [
    ...(row === undefined ? months : months.filter(inBucket(row))),
  ]
    .reverse()
    .map((m) => ({ value: m, label: names.longYear(m) }));
  const groups = entryGroups(entries.data?.entries ?? []);

  return (
    <Drawer
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      side="end"
      size="xl"
    >
      <DrawerPanel>
        <DrawerHeader>
          <DrawerTitle>
            {t("track.entries.title", {
              name: row?.name ?? t("track.entries.outsideName"),
            })}
          </DrawerTitle>
          <DrawerClose />
        </DrawerHeader>
        <DrawerBody>
          <Stack gap={4}>
            <ChoiceSelect
              label={t("track.entries.month")}
              multiple={false}
              value={target.month}
              choices={choices}
              onChange={(next) => {
                if (typeof next === "string") onMonth(next);
              }}
            />
            {entries.isError && (
              <QueryError
                error={entries.error}
                onRetry={() => void entries.refetch()}
              />
            )}
            {entries.data === undefined && !entries.isError && (
              <Skeleton shape="block" blockSize="12rem" />
            )}
            {entries.data !== undefined && (
              <>
                <Stack gap={10}>
                  <BucketEntriesSummary
                    measure={row?.measure}
                    cell={cell}
                    real={entries.data.total.amount}
                    money={money}
                  />
                  {groups.length === 0 && (
                    <Text size="sm" tone="muted">
                      {t("track.entries.empty")}
                    </Text>
                  )}
                  {groups.map((group) => (
                    <BucketEntryGroup
                      key={group.key}
                      group={group}
                      categories={categories}
                      money={money}
                    />
                  ))}
                </Stack>
              </>
            )}
          </Stack>
        </DrawerBody>
      </DrawerPanel>
    </Drawer>
  );
}

// The months in which the bucket exists in the split.
function inBucket(row: TrackRow) {
  return (month: string) =>
    row.months.find((c) => c.month === month)?.state !== "absent";
}
