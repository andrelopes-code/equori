import { useQuery } from "@tanstack/react-query";
import { Grid } from "@slotted/react/grid";
import { Stack } from "@slotted/react/stack";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { RecordSelect, recordOptions } from "@/features/admin/record-select";
import { adminQuery } from "@/features/admin/api";
import { MonthEditor } from "@/features/admin/month-editor";
import { OperationList } from "@/features/admin/operation-list";
import { operations } from "@/features/admin/operations";
import { QueryTable } from "@/features/admin/query-table";
import { RecordTable } from "@/features/admin/record-table";
import { StatementHeadline } from "@/features/admin/statement-headline";
import { TitledSection } from "@/features/admin/titled-section";
import type { AdminContext } from "@/features/admin/use-admin-context";
import { useT } from "@/i18n/i18n-provider";

type Money = components["schemas"]["Money"];
type StatementList = components["schemas"]["StatementList"];
type StatementDetail = components["schemas"]["StatementDetail"];

const sum = (currency: string, ...amounts: number[]): Money => ({
  amount: amounts.reduce((total, amount) => total + amount, 0),
  currency,
});

// The two check columns state their formula as their name: the contract defines no formula.
function statementRows(list: StatementList | undefined) {
  return (list?.items ?? []).map((s) => ({
    ...s,
    "opening+charges-credits": sum(
      s.opening.currency,
      s.opening.amount,
      s.charges.amount,
      -s.credits.amount,
    ),
    "amount_due-payments": sum(
      s.amount_due.currency,
      s.amount_due.amount,
      -s.payments.amount,
    ),
  }));
}

// The postings' amounts added by card role, to compare with the summary's charges, credits and payments.
function roleSums(detail: StatementDetail | undefined) {
  const sums = new Map<string, Money>();
  for (const posting of detail?.postings ?? []) {
    const current = sums.get(posting.card_role);
    sums.set(
      posting.card_role,
      sum(posting.amount.currency, current?.amount ?? 0, posting.amount.amount),
    );
  }
  return [...sums].map(([card_role, amount]) => ({ card_role, amount }));
}

const startsWith = (prefix: string) =>
  operations.cards.filter((op) => op.path.startsWith(prefix));

export function CardsPanel({ ctx }: { ctx: AdminContext }) {
  const t = useT();
  const api = useApi();
  const cardAccounts = ctx.accounts.filter((a) => a.kind === "credit_card");
  const [account, setAccount] = useState(cardAccounts[0]?.id ?? "");
  const [month, setMonth] = useState(ctx.refs.month);
  const [statement, setStatement] = useState("");
  const accountID = account === "" ? (cardAccounts[0]?.id ?? "") : account;
  const statements = useQuery({
    ...adminQuery(api, `/accounts/${accountID}/statements`, { limit: "200" }),
    enabled: accountID !== "",
  });
  const list = statements.data as StatementList | undefined;
  const ofMonth = list?.items.find((s) => s.reference === month);
  const statementID =
    statement === "" ? (ofMonth?.id ?? list?.items[0]?.id ?? "") : statement;
  const detail = useQuery({
    ...adminQuery(api, `/statements/${statementID}`),
    enabled: statementID !== "",
  });

  return (
    <Stack gap={6}>
      <Grid gap={3} minItemWidth="sm">
        <RecordSelect
          label={t("admin.cards.account")}
          options={recordOptions(cardAccounts)}
          value={accountID}
          onChange={setAccount}
        />
        <MonthEditor
          name="month"
          label={t("admin.month")}
          value={month}
          onChange={setMonth}
        />
      </Grid>
      {accountID !== "" && (
        <StatementHeadline
          card={cardAccounts.find((a) => a.id === accountID)}
          month={month}
          statement={ofMonth}
          loading={statements.isPending}
        />
      )}
      {accountID !== "" && (
        <TitledSection title={t("admin.headline.details")}>
          <Stack gap={6}>
            <QueryTable
              caption="billing-cycle-rules"
              path={`/accounts/${accountID}/billing-cycle-rules`}
              cells={ctx.cells}
            />
            <QueryTable
              caption="credit-limits"
              path={`/accounts/${accountID}/credit-limits`}
              cells={ctx.cells}
            />
            <QueryTable
              caption="cards"
              path={`/accounts/${accountID}/cards`}
              cells={ctx.cells}
            />
            <QueryTable
              caption="commitments"
              path={`/accounts/${accountID}/commitments`}
              query={{ month }}
              cells={ctx.cells}
            />
            <RecordTable
              caption={t("admin.cards.statements")}
              rows={statementRows(list)}
              cells={ctx.cells}
            />
            <RecordSelect
              label={t("admin.cards.statement")}
              options={recordOptions(
                (list?.items ?? []).map((s) => ({
                  id: s.id,
                  name: s.reference,
                })),
              )}
              value={statementID}
              onChange={setStatement}
            />
            {statementID !== "" && (
              <>
                <RecordTable
                  caption={t("admin.cards.postings")}
                  rows={
                    (detail.data as StatementDetail | undefined)?.postings ?? []
                  }
                  cells={ctx.cells}
                />
                <RecordTable
                  caption={t("admin.cards.roles")}
                  rows={roleSums(detail.data as StatementDetail | undefined)}
                  cells={ctx.cells}
                />
              </>
            )}
          </Stack>
        </TitledSection>
      )}
      <TitledSection title={t("admin.cards.accountOps")}>
        <OperationList
          key={accountID}
          ops={startsWith("/accounts/")}
          ctx={ctx}
          initial={{ id: accountID, month }}
        />
      </TitledSection>
      <TitledSection title={t("admin.cards.statementOps")}>
        <OperationList
          key={statementID}
          ops={startsWith("/statements/")}
          ctx={ctx}
          initial={{ id: statementID }}
        />
      </TitledSection>
      <TitledSection title={t("admin.cards.otherOps")}>
        <OperationList
          ops={operations.cards.filter(
            (op) =>
              !op.path.startsWith("/accounts/") &&
              !op.path.startsWith("/statements/"),
          )}
          ctx={ctx}
        />
      </TitledSection>
    </Stack>
  );
}
