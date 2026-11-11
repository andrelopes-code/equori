export interface BulkItem {
  id: string;
  status: string;
}

export interface BulkOutcome {
  done: number;
  refused: BulkItem[];
}

// The items a bulk command wrote and those it refused, refusals in request order (FM-10).
export function bulkOutcome(
  results: readonly BulkItem[],
  doneStatus: string,
): BulkOutcome {
  const refused = results.filter((item) => item.status !== doneStatus);
  return { done: results.length - refused.length, refused };
}
