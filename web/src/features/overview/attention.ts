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
  // The account's unconfirmed entries, on its difference item (A133).
  unconfirmed?: number;
  // The card statement of the account's earliest unconfirmed entry.
  statementId?: string;
}

export function attentionItems(input: {
  uncategorized: number;
  unconfirmed: readonly {
    account: Account;
    count: number;
    statementId?: string;
  }[];
  connections: readonly { state: ConnectionState }[];
  differences: readonly { account: Account; difference: Money | undefined }[];
}): AttentionItem[] {
  const stuck = input.connections.filter((c) => c.state !== "ok").length;
  const open = (d: { difference: Money | undefined }) =>
    d.difference !== undefined && d.difference.amount !== 0;
  const differing = new Set(
    input.differences.filter(open).map((d) => d.account.id),
  );
  const count = new Map(input.unconfirmed.map((u) => [u.account.id, u.count]));
  return [
    ...(input.uncategorized > 0
      ? [{ kind: "uncategorized" as const, count: input.uncategorized }]
      : []),
    ...input.unconfirmed
      .filter((u) => u.count > 0 && !differing.has(u.account.id))
      .map((u) => ({
        kind: "unconfirmed" as const,
        count: u.count,
        account: u.account,
        ...(u.statementId === undefined ? {} : { statementId: u.statementId }),
      })),
    ...(stuck > 0 ? [{ kind: "connections" as const, count: stuck }] : []),
    ...input.differences.flatMap((d) =>
      d.difference === undefined || !open(d)
        ? []
        : [
            {
              kind: "difference" as const,
              count: 1,
              account: d.account,
              difference: d.difference,
              ...((count.get(d.account.id) ?? 0) > 0
                ? { unconfirmed: count.get(d.account.id) ?? 0 }
                : {}),
            },
          ],
    ),
  ];
}
