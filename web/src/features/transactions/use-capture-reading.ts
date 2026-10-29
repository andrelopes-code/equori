import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import {
  capturePreviewQuery,
  captureSuggestionsQuery,
} from "@/features/transactions/api";
import {
  lineKeys,
  pruneOverrides,
  suggestionItems,
} from "@/features/transactions/capture-draft";
import type { LineOverride } from "@/features/transactions/capture-draft";
import {
  attentionCount,
  readRows,
  suggestedRows,
} from "@/features/transactions/capture-rows";
import { useDebounced } from "@/ui/use-debounced";

type Account = components["schemas"]["Account"];
type Overrides = Record<string, LineOverride>;

// The pause after the last key before the text is read again.
const readDelay = 250;
const suggestDelay = 1200;

interface CaptureReadingInput {
  text: string;
  overrides: Overrides;
  setOverrides: (update: (o: Overrides) => Overrides) => void;
  defaultAccount: string | null;
  capturedOn: string | null;
  accountsById: Map<string, Account>;
  accountsLoaded: boolean;
}

// The drafts the server reads from the text, with the owner's changes and the categories a
// language model suggested.
export function useCaptureReading({
  text,
  overrides,
  setOverrides,
  defaultAccount,
  capturedOn,
  accountsById,
  accountsLoaded,
}: CaptureReadingInput) {
  const api = useApi();
  const settled = useDebounced(text, readDelay);
  const preview = useQuery({
    ...capturePreviewQuery(api, settled, defaultAccount, capturedOn),
    enabled: settled.trim() !== "" && accountsLoaded,
  });
  const [prunedFor, setPrunedFor] = useState<readonly string[] | null>(null);

  // ADR 014 L5: a language model is asked once the text has been still for a while, so a
  // pause inside a word costs no request.
  const still = useDebounced(text, suggestDelay) === text;

  const empty = text.trim() === "";
  const answered = preview.data?.lines;
  const lines = useMemo(
    () => (empty ? [] : (answered ?? [])),
    [empty, answered],
  );
  // The drafts on screen answer the text as it stands only once the reading caught up.
  const current =
    !empty &&
    settled === text &&
    preview.data !== undefined &&
    !preview.isPlaceholderData &&
    !preview.isFetching;
  const keys = useMemo(() => lineKeys(lines), [lines]);

  // Once the reading caught up, the changes of lines no longer in the text are dropped, so
  // writing a line again starts from its reading (A115).
  if (current && prunedFor !== keys) {
    setPrunedFor(keys);
    setOverrides((o) => pruneOverrides(o, keys));
  }

  const read = readRows(lines, keys, overrides, accountsById);
  const suggestions = useQuery(
    captureSuggestionsQuery(api, current && still ? suggestionItems(read) : []),
  );
  const rows = suggestedRows(read, suggestions.data ?? []);

  return {
    preview,
    empty,
    current,
    keys,
    rows,
    attention: attentionCount(rows),
  };
}
