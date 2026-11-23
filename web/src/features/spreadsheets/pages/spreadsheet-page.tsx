import { Page, PageBody } from "@slotted/react/page";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";

import { useApi } from "@/api/api-context";
import { meQuery } from "@/features/session";
import { SpreadsheetWorkspace } from "@/features/spreadsheets/editor/spreadsheet-workspace";
import { useStoredDocument } from "@/features/spreadsheets/editor/use-stored-document";
import { QueryError } from "@/ui/feedback/query-error";

// One spreadsheet in its editor. The workspace mounts again for another spreadsheet and after
// the reader asks for the saved version, never for a read the query client starts.
export function SpreadsheetPage() {
  const api = useApi();
  const { id } = useParams({ from: "/_authed/spreadsheets/$id" });
  const stored = useStoredDocument(id);
  const { data: me } = useQuery({ ...meQuery(api), staleTime: Infinity });

  if (stored.error !== undefined)
    return (
      <Page width="full">
        <PageBody>
          <QueryError error={stored.error} onRetry={stored.reload} />
        </PageBody>
      </Page>
    );

  if (stored.document === undefined || me === undefined)
    return <Page width="full" loading />;

  return (
    <SpreadsheetWorkspace
      key={stored.key}
      document={stored.document}
      editable={me.book_role !== "read"}
      onReload={stored.reload}
    />
  );
}
