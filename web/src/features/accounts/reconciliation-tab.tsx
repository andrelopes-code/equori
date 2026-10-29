import { Button } from "@slotted/react/button";
import { Card, CardBody } from "@slotted/react/card";
import { Inline } from "@slotted/react/inline";
import { Stack } from "@slotted/react/stack";
import { Heading, Text } from "@slotted/react/typography";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import { ProblemError, errorText } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { AssertionDialog } from "@/features/accounts/assertion-dialog";
import { AssertionHistory } from "@/features/accounts/assertion-history";
import { AssertionOutcomeAlert } from "@/features/accounts/assertion-outcome-alert";
import { assertionOutcome } from "@/features/accounts/assertion-result";
import type { AssertionOutcome } from "@/features/accounts/assertion-result";
import type { AccountSearch } from "@/features/accounts/account-search";
import { OpenDifferenceAlert } from "@/features/accounts/open-difference-alert";
import type { Resolution } from "@/features/accounts/open-difference-alert";
import { UnconfirmedTable } from "@/features/accounts/unconfirmed-table";
import { HelpLink } from "@/features/help";
import {
  reconciliationQuery,
  useResolveAssertion,
} from "@/features/accounts/api";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { Presence } from "@/ui/presence";
import { useMoneyFormat } from "@/privacy/use-money-format";

type Account = components["schemas"]["Account"];

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
  const fmt = useMoneyFormat();
  const api = useApi();
  const navigate = useNavigate();
  const status = useQuery(reconciliationQuery(api, account.id));
  const resolve = useResolveAssertion();
  const [outcome, setOutcome] = useState<AssertionOutcome | null>(null);
  const [remains, setRemains] = useState<string | null>(null);
  const money = (m: components["schemas"]["Money"]) =>
    fmt.money(m, scale(m.currency));
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

  const settle = (resolution: Resolution) => {
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
              <Inline gap={3}>
                <HelpLink page="check-balance" />
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
            </Inline>
            {outcome !== null && (
              <AssertionOutcomeAlert outcome={outcome} scale={scale} />
            )}
            {open !== undefined && (
              <OpenDifferenceAlert
                open={open}
                remains={remains}
                pending={
                  resolve.isPending ? resolve.variables.resolution : undefined
                }
                scale={scale}
                onSettle={settle}
              />
            )}
          </Stack>
        </CardBody>
      </Card>

      <AssertionHistory accountId={account.id} scale={scale} />
      <UnconfirmedTable accountId={account.id} scale={scale} />
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
