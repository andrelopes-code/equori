import type { components } from "@/api/schema.gen";

type Account = components["schemas"]["Account"];
type Money = components["schemas"]["Money"];
type ConnectionState = components["schemas"]["Connection"]["state"];

export interface AttentionItem {
  kind: "uncategorized" | "unconfirmed" | "connections" | "difference";
  count: number;
  account?: Account;
  // The open difference of a reconciliation.
  difference?: Money;
}

export function attentionItems(input: {
  uncategorized: number;
  unconfirmed: readonly { account: Account; count: number }[];
  connections: readonly { state: ConnectionState }[];
  differences: readonly { account: Account; difference: Money | undefined }[];
}): AttentionItem[] {
  const stuck = input.connections.filter((c) => c.state !== "ok").length;
  return [
    ...(input.uncategorized > 0
      ? [{ kind: "uncategorized" as const, count: input.uncategorized }]
      : []),
    ...input.unconfirmed
      .filter((u) => u.count > 0)
      .map((u) => ({
        kind: "unconfirmed" as const,
        count: u.count,
        account: u.account,
      })),
    ...(stuck > 0 ? [{ kind: "connections" as const, count: stuck }] : []),
    ...input.differences.flatMap((d) =>
      d.difference === undefined
        ? []
        : [
            {
              kind: "difference" as const,
              count: 1,
              account: d.account,
              difference: d.difference,
            },
          ],
    ),
  ];
}
