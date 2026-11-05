import type { components } from "@/api/schema.gen";

type ExternalRecord = components["schemas"]["ExternalRecord"];
type BulkResolveItem =
  components["schemas"]["BulkResolveInput"]["items"][number];

// A group line is reviewed whole (A168) and takes no part in a bulk command.
export function isSelectable(record: ExternalRecord): boolean {
  return record.review_reason !== "group";
}

// The selected probable lines, each matched to its first scored candidate (spec D5).
export function suggestionItems(
  records: readonly ExternalRecord[],
  selected: readonly string[],
): BulkResolveItem[] {
  const items: BulkResolveItem[] = [];
  for (const record of records) {
    const first = record.scored_candidates?.[0];
    if (
      selected.includes(record.id) &&
      record.review_reason === "probable" &&
      first
    ) {
      items.push({
        record_id: record.id,
        resolution: { action: "match", transaction_id: first.transaction_id },
      });
    }
  }
  return items;
}

// The selected lines with one action, in queue order.
export function actionItems(
  records: readonly ExternalRecord[],
  selected: readonly string[],
  action: "create" | "discard",
): BulkResolveItem[] {
  return records
    .filter((record) => selected.includes(record.id) && isSelectable(record))
    .map((record) => ({ record_id: record.id, resolution: { action } }));
}
