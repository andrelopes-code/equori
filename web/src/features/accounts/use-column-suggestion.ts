import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { useApi } from "@/api/api-context";
import { errorText } from "@/api/problem";
import { useSuggestCsvColumns } from "@/features/accounts/api";
import {
  applySuggestion,
  csvSample,
  readyProfile,
} from "@/features/accounts/csv-guess";
import type { ProfileDraft } from "@/features/accounts/csv-guess";
import { usesQuery } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";

interface ColumnSuggestionInput {
  id: string;
  text: string;
  draft: ProfileDraft;
  // The preview names a missing column or counts a line it cannot read.
  troubled: boolean;
  onChange: (next: ProfileDraft) => void;
}

// The model's answer for the columns of the file, merged into the draft on success. A failure
// leaves the draft as it was.
export function useColumnSuggestion({
  id,
  text,
  draft,
  troubled,
  onChange,
}: ColumnSuggestionInput) {
  const t = useT();
  const api = useApi();
  // With unknown header rows, the row sent as the header could hold a name.
  const needed = useMemo(
    () =>
      draft.header_rows !== undefined &&
      (troubled || readyProfile(text, draft) === null),
    [text, draft, troubled],
  );
  const uses = useQuery({ ...usesQuery(api), enabled: needed });
  const mutation = useSuggestCsvColumns();
  const target = uses.data?.items.find(
    (use) => use.id === "ingestion.csv_columns",
  );
  const visible = needed && (target?.targets.length ?? 0) > 0;

  function run() {
    mutation.mutate(
      { id, sample: csvSample(text, draft) },
      {
        onSuccess: (suggestion) => {
          onChange(applySuggestion(text, draft, suggestion));
        },
      },
    );
  }

  return {
    visible,
    pending: mutation.isPending,
    error: mutation.error === null ? null : errorText(mutation.error, t),
    run,
  };
}
