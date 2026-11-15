import type { components } from "@/api/schema.gen";

type Change = components["schemas"]["AssistantPreview"]["changes"][number];

export interface ReceiptFields {
  amount: Change["after"];
  // Description, category (or the destination account), account and date, in that order.
  rows: Change[];
}

export function receiptFields(changes: readonly Change[]): ReceiptFields {
  const find = (field: string) => changes.find((c) => c.field === field);
  const rows = [
    find("description"),
    find("category") ?? find("to_account"),
    find("account"),
    find("date"),
  ].filter((change) => change !== undefined);

  return { amount: find("amount")?.after, rows };
}
