import {
  Alert,
  AlertActions,
  AlertContent,
  AlertDescription,
  AlertTitle,
} from "@slotted/react/alert";
import { Button } from "@slotted/react/button";
import { Card, CardBody } from "@slotted/react/card";
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
  TableHead,
  TableLoader,
  TableRow,
  TableRowHeader,
} from "@slotted/react/table";
import { Tag } from "@slotted/react/tag";
import { Heading, Text } from "@slotted/react/typography";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import { ProblemError, errorText } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { AssertionDialog } from "@/features/accounts/assertion-dialog";
import { assertionOutcome } from "@/features/accounts/assertion-result";
import type { AssertionOutcome } from "@/features/accounts/assertion-result";
import type { AccountSearch } from "@/features/accounts/account-search";
import {
  assertionsQuery,
  reconciliationQuery,
  unconfirmedQuery,
  useResolveAssertion,
} from "@/features/accounts/api";
import type { MessageKey } from "@/i18n/catalog.en";
import { formatDate, formatMoney } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useAppLink } from "@/ui/use-app-link";
import { Presence } from "@/ui/presence";

type Account = components["schemas"]["Account"];

const sourceLabel: Record<"manual" | "import" | "aggregator", MessageKey> = {
  manual: "reconciliation.source.manual",
  import: "reconciliation.source.import",
  aggregator: "reconciliation.source.aggregator",
};

const outcomeLabel: Record<AssertionOutcome["kind"], MessageKey> = {
  reconciled: "reconciliation.result.reconciled",
  yield: "reconciliation.result.yield",
  adjustment: "reconciliation.result.adjustment",
  added: "reconciliation.result.added",
  open: "reconciliation.result.open",
};

// F6: the institution's balance against the ledger's, the difference that waits and the two ways
// to close it, the balances recorded so far, and the entries no institution line confirmed.
export function ReconciliationTab({
  account,
  search,
  scale,
}: {
  account: Account;
  search: AccountSearch;
  scale: (code: string) => number;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const api = useApi();
  const navigate = useNavigate();
  const follow = useAppLink();
  const status = useQuery(reconciliationQuery(api, account.id));
  const history = useInfiniteQuery(assertionsQuery(api, account.id));
  const unconfirmed = useQuery(unconfirmedQuery(api, account.id));
  const resolve = useResolveAssertion();
  const [outcome, setOutcome] = useState<AssertionOutcome | null>(null);
  const [remains, setRemains] = useState<string | null>(null);
  const money = (m: components["schemas"]["Money"]) =>
    formatMoney(m, scale(m.currency), locale);
  const open = status.data?.open_difference;
  const last = status.data?.last_reconciled_on;

  const setForm = (on: boolean) => {
    void navigate({
      to: "/accounts/$id",
      params: { id: account.id },
      search: (() => {
        const next: AccountSearch = { ...search };
        delete next.assert;
        return on ? { ...next, assert: true as const } : next;
      })(),
    });
  };

  const settle = (
    resolution: "adjustment" | "yield" | "transactions_added",
  ) => {
    if (open === undefined) return;
    setRemains(null);
    resolve
      .mutateAsync({ id: open.assertion_id, resolution })
      .then((result) => {
        setOutcome(assertionOutcome(result));
      })
      .catch(async (caught: unknown) => {
        if (
          caught instanceof ProblemError &&
          caught.problem.code === "difference_remains"
        ) {
          // ER-02: the status is read again before the message says what is left.
          const fresh = await status.refetch();
          const left = fresh.data?.open_difference?.difference;
          setRemains(
            left === undefined
              ? errorText(caught, t)
              : t("reconciliation.remains", { amount: money(left) }),
          );
          return;
        }
        setRemains(errorText(caught, t));
      });
  };

  const assertions = (history.data?.pages ?? []).flatMap((page) => page.items);

  return (
    <Stack gap={8}>
      <Card>
        <CardBody>
          <Stack gap={4}>
            <Inline justify="between" gap={4}>
              <Stack gap={1}>
                <Heading level={2} size="md">
                  {t("reconciliation.title")}
                </Heading>
                <Text size="sm" tone="muted">
                  {last === undefined
                    ? t("reconciliation.never")
                    : t("reconciliation.lastOn", {
                        date: formatDate(last, locale),
                      })}
                </Text>
              </Stack>
              <Button
                variant="outline"
                onClick={() => {
                  setOutcome(null);
                  setForm(true);
                }}
              >
                {t("reconciliation.record")}
              </Button>
            </Inline>
            {outcome !== null && (
              <Alert
                tone={outcome.kind === "open" ? "warning" : "success"}
                live="polite"
              >
                <AlertContent>
                  <AlertDescription>
                    {t(outcomeLabel[outcome.kind], {
                      amount: money(outcome.difference),
                    })}
                  </AlertDescription>
                </AlertContent>
                {outcome.transactionId !== undefined && (
                  <AlertActions>
                    <Link
                      href={`/transactions/${outcome.transactionId}`}
                      onClick={follow({
                        to: "/transactions/$id",
                        params: { id: outcome.transactionId },
                      })}
                    >
                      {t("reconciliation.viewTransaction")}
                    </Link>
                  </AlertActions>
                )}
              </Alert>
            )}
            {open !== undefined && (
              <Alert tone="warning">
                <AlertContent>
                  <AlertTitle>
                    {t("reconciliation.open", {
                      amount: money(open.difference),
                      date: formatDate(open.date, locale),
                    })}
                  </AlertTitle>
                  <AlertDescription>
                    {remains ?? t("reconciliation.openHint")}
                  </AlertDescription>
                </AlertContent>
                <AlertActions>
                  <Button
                    size="sm"
                    loading={
                      resolve.isPending &&
                      resolve.variables.resolution === "adjustment"
                    }
                    onClick={() => {
                      settle("adjustment");
                    }}
                  >
                    {t("reconciliation.resolve.adjustment", {
                      amount: money(open.difference),
                    })}
                  </Button>
                  {open.difference.amount > 0 && (
                    <Button
                      size="sm"
                      loading={
                        resolve.isPending &&
                        resolve.variables.resolution === "yield"
                      }
                      onClick={() => {
                        settle("yield");
                      }}
                    >
                      {t("reconciliation.resolve.yield", {
                        amount: money(open.difference),
                      })}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    loading={
                      resolve.isPending &&
                      resolve.variables.resolution === "transactions_added"
                    }
                    onClick={() => {
                      settle("transactions_added");
                    }}
                  >
                    {t("reconciliation.resolve.added")}
                  </Button>
                </AlertActions>
              </Alert>
            )}
          </Stack>
        </CardBody>
      </Card>

      <Stack gap={3}>
        <Table columns={5} variant="framed">
          <TableContent>
            <TableCaption>{t("reconciliation.history")}</TableCaption>
            <TableHead>
              <TableRow>
                <TableColumnHeader>
                  {t("reconciliation.date")}
                </TableColumnHeader>
                <TableColumnHeader numeric>
                  {t("reconciliation.reported")}
                </TableColumnHeader>
                <TableColumnHeader>
                  {t("reconciliation.source")}
                </TableColumnHeader>
                <TableColumnHeader>
                  {t("reconciliation.recordedAt")}
                </TableColumnHeader>
                <TableColumnHeader>
                  {t("reconciliation.state")}
                </TableColumnHeader>
              </TableRow>
            </TableHead>
            {history.isPending ? (
              <TableLoader skeletonRows={3} />
            ) : (
              <TableBody>
                {assertions.length === 0 && (
                  <TableEmpty>{t("reconciliation.historyEmpty")}</TableEmpty>
                )}
                {assertions.map((a) => (
                  <TableRow key={a.id} value={a.id}>
                    <TableRowHeader>
                      {formatDate(a.date, locale)}
                    </TableRowHeader>
                    <TableCell numeric>{money(a.amount)}</TableCell>
                    <TableCell>{t(sourceLabel[a.source])}</TableCell>
                    <TableCell>
                      {formatDate(a.recorded_at.slice(0, 10), locale)}
                    </TableCell>
                    <TableCell>
                      {a.reconciled ? (
                        <Tag size="sm" tone="success">
                          {t("reconciliation.matched")}
                        </Tag>
                      ) : (
                        <Tag size="sm" tone="warning">
                          {t("reconciliation.unmatched")}
                        </Tag>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            )}
          </TableContent>
        </Table>
        {history.hasNextPage && (
          <div>
            <Button
              variant="outline"
              tone="secondary"
              loading={history.isFetchingNextPage}
              onClick={() => void history.fetchNextPage()}
            >
              {t("reconciliation.more")}
            </Button>
          </div>
        )}
      </Stack>

      <Stack gap={3}>
        <Table columns={3} variant="framed">
          <TableContent>
            <TableCaption>{t("reconciliation.unconfirmed")}</TableCaption>
            <TableHead>
              <TableRow>
                <TableColumnHeader>
                  {t("reconciliation.date")}
                </TableColumnHeader>
                <TableColumnHeader>{t("ledger.movement")}</TableColumnHeader>
                <TableColumnHeader numeric>
                  {t("ledger.amount")}
                </TableColumnHeader>
              </TableRow>
            </TableHead>
            {unconfirmed.isPending ? (
              <TableLoader skeletonRows={2} />
            ) : (
              <TableBody>
                {(unconfirmed.data ?? []).length === 0 && (
                  <TableEmpty>
                    {t("reconciliation.unconfirmedEmpty")}
                  </TableEmpty>
                )}
                {(unconfirmed.data ?? []).map((entry) => (
                  <TableRow
                    key={entry.transaction_id}
                    value={entry.transaction_id}
                  >
                    <TableRowHeader>
                      {formatDate(entry.date, locale)}
                    </TableRowHeader>
                    <TableCell>
                      <Link
                        variant="neutral"
                        underline="hover"
                        href={`/transactions/${entry.transaction_id}`}
                        onClick={follow({
                          to: "/transactions/$id",
                          params: { id: entry.transaction_id },
                        })}
                      >
                        {entry.description === ""
                          ? t("ledger.untitled")
                          : entry.description}
                      </Link>
                    </TableCell>
                    <TableCell numeric>{money(entry.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            )}
          </TableContent>
        </Table>
        <Text size="sm" tone="muted">
          {t("reconciliation.unconfirmedNote")}
        </Text>
      </Stack>
      <Presence value={search.assert === true ? true : undefined}>
        {() => (
          <AssertionDialog
            account={account}
            scale={scale(account.currency)}
            onCancel={() => {
              setForm(false);
            }}
            onDone={(result) => {
              setOutcome(assertionOutcome(result));
              setForm(false);
            }}
          />
        )}
      </Presence>
    </Stack>
  );
}
