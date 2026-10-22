import { Button } from "@slotted/react/button";
import { Page, PageBody } from "@slotted/react/page";
import {
  ResultState,
  ResultStateContent,
  ResultStateDescription,
  ResultStateTitle,
} from "@slotted/react/result-state";
import { Segment, SegmentedControl } from "@slotted/react/segmented-control";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useDeferredValue } from "react";

import { useApi } from "@/api/api-context";
import { AccountFormHeader } from "@/features/accounts/account-form-header";
import {
  accountQuery,
  batchRecordsQuery,
  importBatchQuery,
} from "@/features/accounts/api";
import styles from "@/features/accounts/batch-page.module.css";
import { BatchRecordsTable } from "@/features/accounts/batch-records-table";
import type { RecordFilter } from "@/features/accounts/batch-search";
import { sourceLabel } from "@/features/accounts/imports-tab";
import { ReviewQueue } from "@/features/accounts/review-queue";
import { ReviewRecord } from "@/features/accounts/review-record";
import { useScale } from "@/features/setup";
import type { MessageKey } from "@/i18n/catalog.en";
import { formatDate, formatMoney } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { FigureCard } from "@/ui/figure-card";
import { FigureGrid } from "@/ui/figure-grid";
import { QueryError } from "@/ui/query-error";
import { compactQuery, useMediaQuery } from "@/ui/use-media-query";

const filterWords: Record<RecordFilter, MessageKey> = {
  needs_review: "batch.filter.needs_review",
  all: "batch.filter.all",
  matched: "batch.filter.matched",
  created: "batch.filter.created",
  discarded: "batch.filter.discarded",
  withdrawn: "batch.filter.withdrawn",
};

// One import: what became of its lines and of its balance, and the review of the lines matching
// could not settle alone (WS-01, WS-02).
export function BatchPage() {
  const t = useT();
  const [locale] = useAppLocale();
  const api = useApi();
  const navigate = useNavigate();
  const compact = useMediaQuery(compactQuery);
  const scale = useScale();
  const { id, batchId } = useParams({
    from: "/_authed/accounts/$id/imports/$batchId",
  });
  const search = useSearch({ from: "/_authed/accounts/$id/imports/$batchId" });
  const account = useQuery(accountQuery(api, id));
  const batch = useQuery(importBatchQuery(api, batchId));
  const counts = batch.data?.counts;
  const filter: RecordFilter =
    search.state ?? (counts?.needs_review === 0 ? "all" : "needs_review");
  const shown = useDeferredValue(filter);
  const records = useInfiniteQuery({
    ...batchRecordsQuery(api, batchId, shown === "all" ? undefined : shown),
    enabled: batch.data !== undefined,
  });
  const rows = (records.data?.pages ?? []).flatMap((page) => page.items);
  const current = rows.find((r) => r.id === search.record);
  const sc = scale ?? (() => 2);

  const setFilter = (state: RecordFilter) => {
    void navigate({
      to: "/accounts/$id/imports/$batchId",
      params: { id, batchId },
      search: { state },
      replace: true,
    });
  };
  const setRecord = (record: string | undefined, replace = false) => {
    void navigate({
      to: "/accounts/$id/imports/$batchId",
      params: { id, batchId },
      search: (prev) => {
        const next = { ...prev };
        delete next.record;
        return record === undefined ? next : { ...next, record };
      },
      replace,
    });
  };

  const title =
    batch.data === undefined
      ? t("batch.title")
      : (batch.data.file_name ?? t(sourceLabel[batch.data.source]));
  const balance = batch.data?.balance;
  const filters: RecordFilter[] = [
    "needs_review",
    "all",
    "matched",
    "created",
    "discarded",
    ...(batch.data?.source === "aggregator" ? (["withdrawn"] as const) : []),
  ];
  const showQueue = !compact || current === undefined;
  const showRecord = !compact || current !== undefined;

  return (
    <Page width="full">
      <AccountFormHeader
        title={title}
        subtitle={
          batch.data === undefined
            ? t("batch.subtitle")
            : [
                account.data?.name,
                batch.data.period_from === undefined ||
                batch.data.period_to === undefined
                  ? undefined
                  : t("imports.range", {
                      from: formatDate(batch.data.period_from, locale),
                      to: formatDate(batch.data.period_to, locale),
                    }),
                t("batch.importedOn", {
                  date: formatDate(batch.data.started_at.slice(0, 10), locale),
                }),
              ]
                .filter((part) => part !== undefined)
                .join(" · ")
        }
        back={{ to: "/accounts/$id", params: { id } }}
        backLabel={account.data?.name ?? t("nav.accounts")}
      />
      <PageBody>
        {batch.isError ? (
          <QueryError
            error={batch.error}
            onRetry={() => void batch.refetch()}
          />
        ) : (
          <Stack gap={6}>
            <FigureGrid label={t("batch.figures")}>
              {(
                [
                  ["received", "batch.figure.received"],
                  ["matched", "batch.figure.matched"],
                  ["created", "batch.figure.created"],
                  ["needs_review", "batch.figure.needs_review"],
                  ["discarded", "batch.figure.discarded"],
                  ["ignored", "batch.figure.ignored"],
                  ...(batch.data?.source === "aggregator"
                    ? ([
                        ["updated", "batch.figure.updated"],
                        ["withdrawn", "batch.figure.withdrawn"],
                      ] as const)
                    : []),
                ] as const
              ).map(([key, label]) => (
                <FigureCard
                  key={key}
                  label={t(label)}
                  value={counts === undefined ? undefined : String(counts[key])}
                  note={t(`batch.note.${key}`)}
                  loading={batch.isPending}
                />
              ))}
            </FigureGrid>
            {balance !== undefined && (
              <Text size="sm">
                {balance.status === "recorded" &&
                balance.amount !== undefined &&
                balance.date !== undefined
                  ? t("batch.balance.recorded", {
                      amount: formatMoney(
                        balance.amount,
                        sc(balance.amount.currency),
                        locale,
                      ),
                      date: formatDate(balance.date, locale),
                    })
                  : balance.status === "skipped"
                    ? t("batch.balance.skipped", {
                        reason: balance.reason ?? "",
                      })
                    : t("batch.balance.none")}
              </Text>
            )}
            <div>
              <SegmentedControl
                size="sm"
                aria-label={t("batch.filter")}
                value={filter}
                onValueChange={(value) => {
                  const next = filters.find((f) => f === value);
                  if (next !== undefined) setFilter(next);
                }}
              >
                {filters.map((f) => (
                  <Segment key={f} value={f}>
                    {f === "needs_review" && counts !== undefined
                      ? t("batch.filter.needs_reviewCount", {
                          count: counts.needs_review,
                        })
                      : t(filterWords[f])}
                  </Segment>
                ))}
              </SegmentedControl>
            </div>
            {shown !== "needs_review" ? (
              <BatchRecordsTable
                records={rows}
                loading={records.isPending}
                scale={sc}
              />
            ) : !records.isPending && rows.length === 0 ? (
              <ResultState status="empty" reach="section">
                <ResultStateContent>
                  <ResultStateTitle>{t("batch.reviewDone")}</ResultStateTitle>
                  <ResultStateDescription>
                    {t("batch.reviewDoneHint")}
                  </ResultStateDescription>
                </ResultStateContent>
              </ResultState>
            ) : (
              <div
                className={styles.workspace}
                aria-busy={records.isFetching || undefined}
              >
                {showQueue && (
                  <ReviewQueue
                    accountId={id}
                    batchId={batchId}
                    records={rows}
                    current={current?.id}
                    scale={sc}
                  />
                )}
                {showRecord &&
                  (current === undefined ? (
                    <Text size="sm" tone="muted">
                      {t("batch.choose")}
                    </Text>
                  ) : (
                    <Stack gap={3}>
                      {compact && (
                        <div>
                          <Button
                            size="sm"
                            variant="ghost"
                            tone="secondary"
                            onClick={() => {
                              setRecord(undefined);
                            }}
                          >
                            {t("batch.backToQueue")}
                          </Button>
                        </div>
                      )}
                      <ReviewRecord
                        key={current.id}
                        record={current}
                        scale={sc}
                        onStale={() => void records.refetch()}
                        onResolved={() => {
                          const index = rows.findIndex(
                            (r) => r.id === current.id,
                          );
                          const next = rows[index + 1] ?? rows[index - 1];
                          setRecord(next?.id, true);
                          void batch.refetch();
                        }}
                      />
                    </Stack>
                  ))}
              </div>
            )}
          </Stack>
        )}
      </PageBody>
    </Page>
  );
}
