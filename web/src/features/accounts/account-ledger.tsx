import { Button } from "@slotted/react/button";
import { Glyph, Icon } from "@slotted/react/icon";
import { Inline } from "@slotted/react/inline";
import { Link } from "@slotted/react/link";
import { Stack } from "@slotted/react/stack";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableColumnHeader,
  TableContent,
  TableEmpty,
  TableGroupRow,
  TableHead,
  TableLoader,
  TableRow,
  TableRowHeader,
} from "@slotted/react/table";
import { Tag } from "@slotted/react/tag";
import { Text } from "@slotted/react/typography";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Fragment, useMemo } from "react";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import styles from "@/features/accounts/account-ledger.module.css";
import type { AccountSearch } from "@/features/accounts/account-search";
import {
  accountTransactionsQuery,
  accountsQuery,
  balanceQuery,
} from "@/features/accounts/api";
import {
  ledgerRows,
  runningBalances,
} from "@/features/accounts/running-balance";
import type { LedgerRow } from "@/features/accounts/running-balance";
import { payeesQuery } from "@/features/setup";
import type { MessageKey } from "@/i18n/catalog.en";
import {
  formatDayHeader,
  formatMoney,
  formatSigned,
  shiftDate,
} from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { PeriodControl } from "@/ui/period-control";
import { useAppLink } from "@/ui/use-app-link";

type Account = components["schemas"]["Account"];

const statusLabel: Record<LedgerRow["status"], MessageKey> = {
  pending: "posting.status.pending",
  cleared: "posting.status.cleared",
  reconciled: "posting.status.reconciled",
};

const statusGlyph = {
  pending: "clock",
  cleared: "check",
  reconciled: "lock",
} as const;

// LG-01, LG-02: each movement of the account with its signed change, what it was and where the
// money went, its state, and — where the account is one position — the balance it left.
export function AccountLedger({
  account,
  descendants,
  search,
  scale,
}: {
  account: Account;
  descendants: Account[];
  search: AccountSearch;
  scale: (code: string) => number;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const api = useApi();
  const today = useToday();
  const navigate = useNavigate();
  const follow = useAppLink();
  const to = search.to ?? today;
  const from = search.from ?? shiftDate(to, -89);
  const leaf = descendants.length === 0;
  const pages = useInfiniteQuery(
    accountTransactionsQuery(api, account.id, from, to),
  );
  const closing = useQuery({
    ...balanceQuery(api, account.id, to, "booked"),
    enabled: leaf,
  });
  const accounts = useQuery(accountsQuery(api));
  const payees = useQuery(payeesQuery(api));
  const names = useMemo(
    () => new Map((accounts.data ?? []).map((a) => [a.id, a.name])),
    [accounts.data],
  );
  const payeeNames = useMemo(
    () => new Map((payees.data ?? []).map((p) => [p.id, p.name])),
    [payees.data],
  );

  const rows = useMemo(() => {
    const transactions = (pages.data?.pages ?? []).flatMap(
      (page) => page.items,
    );
    const ids = new Set([account.id, ...descendants.map((d) => d.id)]);
    return ledgerRows(transactions, ids).sort((a, b) =>
      a.date === b.date ? 0 : a.date < b.date ? 1 : -1,
    );
  }, [pages.data, account.id, descendants]);
  const balances =
    leaf && closing.data !== undefined
      ? runningBalances(rows, closing.data.balance.amount)
      : undefined;
  const days = useMemo(() => {
    const byDay = new Map<string, LedgerRow[]>();
    for (const row of rows)
      byDay.set(row.date, [...(byDay.get(row.date) ?? []), row]);
    return [...byDay.entries()];
  }, [rows]);
  const columns = leaf ? 5 : 4;
  const money = (amount: number, currency: string) =>
    formatMoney({ amount, currency }, scale(currency), locale);

  return (
    <Stack gap={4}>
      <Inline justify="between" gap={4}>
        <PeriodControl
          value={{ from, to }}
          onChange={(period) => {
            void navigate({
              to: "/accounts/$id",
              params: { id: account.id },
              search: (() => {
                const next: AccountSearch = { ...search };
                delete next.from;
                delete next.to;
                return period === undefined ? next : { ...next, ...period };
              })(),
              replace: true,
            });
          }}
        />
      </Inline>
      <Table
        columns={columns}
        variant="framed"
        loading={pages.isFetching && !pages.isPending}
      >
        <TableContent>
          <TableCaption>{t("ledger.caption")}</TableCaption>
          <TableHead>
            <TableRow>
              <TableColumnHeader>{t("ledger.movement")}</TableColumnHeader>
              <TableColumnHeader>{t("ledger.other")}</TableColumnHeader>
              <TableColumnHeader>{t("ledger.status")}</TableColumnHeader>
              <TableColumnHeader numeric>
                {t("ledger.amount")}
              </TableColumnHeader>
              {leaf && (
                <TableColumnHeader numeric>
                  {t("ledger.balanceAfter")}
                </TableColumnHeader>
              )}
            </TableRow>
          </TableHead>
          {pages.isPending ? (
            <TableLoader skeletonRows={8} />
          ) : (
            <TableBody>
              {rows.length === 0 && (
                <TableEmpty>{t("ledger.empty")}</TableEmpty>
              )}
              {days.map(([day, dayRows]) => {
                const net = dayRows.reduce((sum, r) => sum + r.amount, 0);
                const currency = dayRows[0]?.currency ?? account.currency;
                return (
                  <Fragment key={day}>
                    <TableGroupRow
                      end={formatSigned(
                        { amount: net, currency },
                        scale(currency),
                        locale,
                      )}
                    >
                      {formatDayHeader(day, today, locale, {
                        today: t("day.today"),
                        yesterday: t("day.yesterday"),
                      })}
                    </TableGroupRow>
                    {dayRows.map((row) => {
                      const tx = row.transaction;
                      const title =
                        (tx.payee_id === undefined
                          ? undefined
                          : payeeNames.get(tx.payee_id)) ??
                        (tx.description === ""
                          ? t("ledger.untitled")
                          : tx.description);
                      const balance = balances?.get(row.id);
                      return (
                        <TableRow
                          key={row.id}
                          value={row.id}
                          onAction={() => {
                            void navigate({
                              to: "/transactions/$id",
                              params: { id: row.id },
                            });
                          }}
                        >
                          <TableRowHeader>
                            <Stack gap={0}>
                              <Inline gap={2}>
                                <Link
                                  variant="neutral"
                                  underline="hover"
                                  href={`/transactions/${row.id}`}
                                  onClick={follow({
                                    to: "/transactions/$id",
                                    params: { id: row.id },
                                  })}
                                >
                                  <span
                                    className={
                                      row.voided ? styles.voided : undefined
                                    }
                                  >
                                    {title}
                                  </span>
                                </Link>
                                {row.voided && (
                                  <Tag size="sm" tone="secondary">
                                    {t("ledger.voided")}
                                  </Tag>
                                )}
                              </Inline>
                              {tx.payee_id !== undefined &&
                                tx.description !== "" && (
                                  <Text size="xs" tone="muted">
                                    {tx.description}
                                  </Text>
                                )}
                            </Stack>
                          </TableRowHeader>
                          <TableCell>
                            <Text size="sm" tone="muted">
                              {row.counterparts
                                .map(
                                  (id) =>
                                    names.get(id) ?? t("ledger.unknownAccount"),
                                )
                                .join(", ")}
                            </Text>
                          </TableCell>
                          <TableCell>
                            <span
                              role="img"
                              aria-label={t(statusLabel[row.status])}
                              title={t(statusLabel[row.status])}
                            >
                              <Icon size="sm">
                                <Glyph name={statusGlyph[row.status]} />
                              </Icon>
                            </span>
                          </TableCell>
                          <TableCell numeric>
                            <Text
                              size="sm"
                              weight="semibold"
                              className={
                                row.voided
                                  ? styles.voided
                                  : row.amount > 0
                                    ? styles.positive
                                    : undefined
                              }
                            >
                              {formatSigned(
                                {
                                  amount: row.voided
                                    ? row.transaction.postings
                                        .filter(
                                          (p) => p.account_id === account.id,
                                        )
                                        .reduce(
                                          (s, p) => s + p.amount.amount,
                                          0,
                                        )
                                    : row.amount,
                                  currency: row.currency,
                                },
                                scale(row.currency),
                                locale,
                              )}
                            </Text>
                          </TableCell>
                          {leaf && (
                            <TableCell numeric>
                              <Text size="sm">
                                {balance === undefined
                                  ? ""
                                  : money(balance, account.currency)}
                              </Text>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </Fragment>
                );
              })}
            </TableBody>
          )}
        </TableContent>
      </Table>
      {pages.hasNextPage && (
        <div>
          <Button
            variant="outline"
            tone="secondary"
            loading={pages.isFetchingNextPage}
            onClick={() => void pages.fetchNextPage()}
          >
            {t("ledger.more")}
          </Button>
        </div>
      )}
      <Text size="sm" tone="muted">
        {leaf ? t("ledger.balanceNote") : t("ledger.parentNote")}
      </Text>
    </Stack>
  );
}
