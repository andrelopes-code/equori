import { Button } from "@slotted/react/button";
import { Page, PageBody } from "@slotted/react/page";
import {
  ResultState,
  ResultStateActions,
  ResultStateContent,
  ResultStateDescription,
  ResultStateTitle,
} from "@slotted/react/result-state";
import { toast } from "@slotted/react/toast";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import { errorText } from "@/api/problem";
import { meQuery } from "@/features/session";
import {
  spreadsheetsQuery,
  useCreateSpreadsheet,
} from "@/features/spreadsheets/api";
import type { SpreadsheetSummary } from "@/features/spreadsheets/api";
import type { DocumentCommand } from "@/features/spreadsheets/document-list/document-command";
import { DocumentDialogs } from "@/features/spreadsheets/document-list/document-dialogs";
import { DocumentGrid } from "@/features/spreadsheets/document-list/document-grid";
import { firstContent } from "@/features/spreadsheets/model/first-content";
import { SpreadsheetsHeader } from "@/features/spreadsheets/pages/spreadsheets-header";
import { useT } from "@/i18n/i18n-provider";
import { QueryError } from "@/ui/feedback/query-error";

// The spreadsheets of the book: open, create, rename, copy and delete.
export function SpreadsheetsPage() {
  const t = useT();
  const api = useApi();
  const navigate = useNavigate();
  const documents = useQuery(spreadsheetsQuery(api));
  const { data: me } = useQuery({ ...meQuery(api), staleTime: Infinity });
  const create = useCreateSpreadsheet();
  const [command, setCommand] = useState<DocumentCommand | null>(null);

  const canWrite = me !== undefined && me.book_role !== "read";
  const empty = documents.data?.length === 0;

  function handleCreate() {
    create
      .mutateAsync({
        name: t("spreadsheets.untitled"),
        content: firstContent(t("spreadsheets.firstSheet")),
      })
      .then((created) =>
        navigate({ to: "/spreadsheets/$id", params: { id: created.id } }),
      )
      .catch((caught: unknown) => {
        toast.show({ tone: "danger", title: errorText(caught, t) });
      });
  }

  function handleDone(done: DocumentCommand, result?: SpreadsheetSummary) {
    setCommand(null);

    if (done.kind === "delete")
      toast.show({ tone: "success", title: t("spreadsheets.deleted") });

    if (done.kind === "copy" && result !== undefined)
      void navigate({ to: "/spreadsheets/$id", params: { id: result.id } });
  }

  return (
    <Page width="full" fill>
      <SpreadsheetsHeader
        canCreate={canWrite}
        creating={create.isPending}
        onCreate={handleCreate}
      />

      <PageBody>
        {documents.isError && (
          <QueryError
            error={documents.error}
            onRetry={() => void documents.refetch()}
          />
        )}

        {empty && (
          <ResultState status="empty" reach="section">
            <ResultStateContent>
              <ResultStateTitle>{t("spreadsheets.empty")}</ResultStateTitle>
              <ResultStateDescription>
                {t("spreadsheets.emptyHint")}
              </ResultStateDescription>
            </ResultStateContent>

            {canWrite && (
              <ResultStateActions>
                <Button loading={create.isPending} onClick={handleCreate}>
                  {t("spreadsheets.new")}
                </Button>
              </ResultStateActions>
            )}
          </ResultState>
        )}

        {!documents.isError && !empty && (
          <DocumentGrid
            documents={documents.data ?? []}
            loading={documents.isPending}
            canWrite={canWrite}
            onCommand={setCommand}
          />
        )}
      </PageBody>

      <DocumentDialogs
        command={command}
        onCancel={() => {
          setCommand(null);
        }}
        onDone={handleDone}
      />
    </Page>
  );
}
