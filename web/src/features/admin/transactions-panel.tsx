import { useQuery } from "@tanstack/react-query";
import { Grid } from "@slotted/react/grid";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { adminQuery } from "@/features/admin/api";
import { postingSums } from "@/features/admin/cell-text";
import { LeafEditor } from "@/features/admin/leaf-editor";
import { OperationList } from "@/features/admin/operation-list";
import { operations } from "@/features/admin/operations";
import { RecordTable } from "@/features/admin/record-table";
import { TitledSection } from "@/features/admin/titled-section";
import type { AdminContext } from "@/features/admin/use-admin-context";
import { useT } from "@/i18n/i18n-provider";
import { shiftDate } from "@/i18n/format";

type TransactionPage = components["schemas"]["TransactionPage"];

const filterNames = ["account_id", "from", "to", "q", "limit"] as const;
type Filters = Record<(typeof filterNames)[number], string>;

const columns = [
  "date",
  "transaction",
  "version",
  "origin",
  "description",
  "payee_id",
  "tags",
  "voided_at",
  "links",
  "account_id",
  "amount",
  "weight",
  "status",
  "settled_on",
  "statement",
  "card_role",
  "installment",
  "original",
  "memo",
  "sum",
] as const;

// One row per posting; the transaction's own fields and its sum by currency open its first row.
function postingRows(page: TransactionPage | undefined) {
  return (page?.items ?? []).flatMap((tx) =>
    tx.postings.map((posting, index) => ({
      ...(index === 0
        ? {
            date: tx.date,
            transaction: tx.id,
            version: tx.version,
            origin: tx.origin,
            description: tx.description,
            payee_id: tx.payee_id,
            tags: tx.tags.length > 0 ? tx.tags : undefined,
            voided_at: tx.voided_at,
            links: tx.links.length > 0 ? tx.links : undefined,
            sum: postingSums(tx.postings),
          }
        : {}),
      ...posting,
    })),
  );
}

export function TransactionsPanel({ ctx }: { ctx: AdminContext }) {
  const t = useT();
  const api = useApi();
  const [filters, setFilters] = useState<Filters>({
    account_id: "",
    from: shiftDate(ctx.refs.today, -60),
    to: shiftDate(ctx.refs.today, 60),
    q: "",
    limit: "50",
  });
  const page = useQuery(adminQuery(api, "/transactions", filters));
  const data = page.data as TransactionPage | undefined;

  return (
    <Stack gap={6}>
      <Grid gap={3} minItemWidth="sm">
        {filterNames.map((name) => (
          <LeafEditor
            key={name}
            name={name}
            value={filters[name]}
            onChange={(value) => {
              setFilters((current) => ({ ...current, [name]: String(value) }));
            }}
            ctx={ctx}
          />
        ))}
      </Grid>
      {data?.next_cursor !== undefined && (
        <Text tone="warning">
          {t("admin.transactions.more", { cursor: data.next_cursor })}
        </Text>
      )}
      <RecordTable
        caption={t("admin.transactions.table")}
        rows={postingRows(data)}
        cells={ctx.cells}
        columns={columns}
      />
      <TitledSection title={t("admin.ops")}>
        <OperationList ops={operations.transactions} ctx={ctx} />
      </TitledSection>
    </Stack>
  );
}
