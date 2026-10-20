import { useQuery } from "@tanstack/react-query";
import { Grid } from "@slotted/react/grid";
import { Inline } from "@slotted/react/inline";
import { Stack } from "@slotted/react/stack";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import { adminQuery } from "@/features/admin/api";
import { DateEditor } from "@/features/admin/date-editor";
import { FigureTile } from "@/features/admin/figure-tile";
import { OperationList } from "@/features/admin/operation-list";
import { operations } from "@/features/admin/operations";
import { RecordTable } from "@/features/admin/record-table";
import { TitledSection } from "@/features/admin/titled-section";
import type { AdminContext } from "@/features/admin/use-admin-context";
import { useDisplay } from "@/features/admin/use-display";
import { useT } from "@/i18n/i18n-provider";

interface Money {
  amount: number;
  currency: string;
}

interface BalanceItem {
  account_id: string;
  balance: Money;
  value?: unknown;
}

function byAccount(body: unknown): Map<string, BalanceItem> {
  const items = (body as { items?: BalanceItem[] } | undefined)?.items ?? [];
  return new Map(items.map((item) => [item.account_id, item]));
}

const columns = [
  "id",
  "name",
  "class",
  "kind",
  "currency",
  "parent_id",
  "institution_id",
  "opened_on",
  "closed_on",
  "system_role",
  "yield_mode",
  "booked",
  "settled",
  "value",
  "card",
] as const;

export function AccountsPanel({ ctx }: { ctx: AdminContext }) {
  const t = useT();
  const api = useApi();
  const show = useDisplay();
  const [date, setDate] = useState(ctx.refs.today);
  const booked = useQuery(
    adminQuery(api, "/balances", { date, basis: "booked" }),
  );
  const settled = useQuery(
    adminQuery(api, "/balances", { date, basis: "settled" }),
  );
  const bookedBy = byAccount(booked.data);
  const settledBy = byAccount(settled.data);
  const rows = ctx.accounts.map((account) => ({
    ...account,
    booked: bookedBy.get(account.id)?.balance,
    settled: settledBy.get(account.id)?.balance,
    value: bookedBy.get(account.id)?.value,
  }));

  // Open balance sheet accounts, assets first: the ones an institution reports a balance for.
  const held = ctx.accounts
    .filter(
      (a) =>
        (a.class === "asset" || a.class === "liability") &&
        a.system_role === undefined &&
        a.closed_on === undefined,
    )
    .sort((a, b) => a.class.localeCompare(b.class));
  // An account without postings until the date is absent from /balances: its balance is zero.
  const balanceOf = (
    by: Map<string, BalanceItem>,
    account: (typeof held)[number],
  ): Money =>
    by.get(account.id)?.balance ?? { amount: 0, currency: account.currency };

  return (
    <Stack gap={6}>
      <Inline>
        <DateEditor
          name="date"
          label={t("admin.date")}
          value={date}
          onChange={setDate}
        />
      </Inline>
      <Grid gap={4} minItemWidth="sm">
        {held.map((account) => (
          <FigureTile
            key={account.id}
            size="md"
            label={account.name}
            loading={booked.isPending || settled.isPending}
            value={show.money(balanceOf(bookedBy, account))}
            comparison={t("admin.headline.settled", {
              value: show.money(balanceOf(settledBy, account)),
            })}
          />
        ))}
      </Grid>
      <RecordTable
        caption={t("admin.accounts.table")}
        rows={rows}
        cells={ctx.cells}
        columns={columns}
      />
      <TitledSection title={t("admin.ops")}>
        <OperationList ops={operations.accounts} ctx={ctx} initial={{ date }} />
      </TitledSection>
    </Stack>
  );
}
