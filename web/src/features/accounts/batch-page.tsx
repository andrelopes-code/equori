import { Page, PageBody } from "@slotted/react/page";
import {
  ResultState,
  ResultStateContent,
  ResultStateDescription,
  ResultStateTitle,
} from "@slotted/react/result-state";
import { Stack } from "@slotted/react/stack";
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
import { BatchFigures } from "@/features/accounts/batch-figures";
import { BatchRecordsTable } from "@/features/accounts/batch-records-table";
import type { RecordFilter } from "@/features/accounts/batch-search";
import { batchSubtitle } from "@/features/accounts/batch-subtitle";
import { sourceLabel } from "@/features/accounts/imports-tab";
import { RecordFilterControl } from "@/features/accounts/record-filter-control";
import { ReviewWorkspace } from "@/features/accounts/review-workspace";
import { useScale } from "@/features/setup";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { QueryError } from "@/ui/query-error";

// One import: what became of its lines and of its balance, and the review of the lines matching
// could not settle alone (WS-01, WS-02).
export function BatchPage() {
  const t = useT();
  const [locale] = useAppLocale();
  const api = useApi();
  const navigate = useNavigate();
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
  const filters: RecordFilter[] = [
    "needs_review",
    "all",
    "matched",
    "created",
    "discarded",
    ...(batch.data?.source === "aggregator" ? (["withdrawn"] as const) : []),
  ];

  return (
    <Page width="full">
      <AccountFormHeader
        title={title}
        subtitle={
          batch.data === undefined
            ? t("batch.subtitle")
            : batchSubtitle(batch.data, account.data?.name, locale, t)
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
            <BatchFigures
              batch={batch.data}
              pending={batch.isPending}
              scale={sc}
            />
            <RecordFilterControl
              filter={filter}
              filters={filters}
              needsReview={counts?.needs_review}
              onChange={setFilter}
            />
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
              <ReviewWorkspace
                accountId={id}
                batchId={batchId}
                records={rows}
                current={current}
                scale={sc}
                busy={records.isFetching}
                onStale={() => void records.refetch()}
                onResolved={() => {
                  const index = rows.findIndex((r) => r.id === current?.id);
                  const next = rows[index + 1] ?? rows[index - 1];
                  setRecord(next?.id, true);
                  void batch.refetch();
                }}
              />
            )}
          </Stack>
        )}
      </PageBody>
    </Page>
  );
}
