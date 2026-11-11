export type RecordFilter =
  "needs_review" | "all" | "matched" | "created" | "discarded" | "withdrawn";

export interface BatchSearch {
  state?: RecordFilter;
  record?: string;
}

const filters: readonly RecordFilter[] = [
  "needs_review",
  "all",
  "matched",
  "created",
  "discarded",
  "withdrawn",
];

// WS-01: the line under review is a place in the address, so a phone's back gesture returns to
// the queue and a link reopens the same line.
export function validateBatchSearch(raw: Record<string, unknown>): BatchSearch {
  const state = filters.find((f) => f === raw.state);
  return {
    ...(state === undefined ? {} : { state }),
    ...(typeof raw.record === "string" && raw.record !== ""
      ? { record: raw.record }
      : {}),
  };
}
