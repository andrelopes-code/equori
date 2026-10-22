import {
  Alert,
  AlertActions,
  AlertContent,
  AlertDescription,
} from "@slotted/react/alert";
import { Button } from "@slotted/react/button";
import { Page, PageBody } from "@slotted/react/page";
import { Stack } from "@slotted/react/stack";
import { toast } from "@slotted/react/toast";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useDeferredValue, useState } from "react";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import {
  AccountSetupMessage,
  CloseAccountDialog,
  ReopenAccountDialog,
} from "@/features/accounts";
import {
  billingRulesQuery,
  cardsQuery,
  statementsQuery,
} from "@/features/cards/api";
import { CardFigures } from "@/features/cards/card-figures";
import { CardHeader } from "@/features/cards/card-header";
import type { CardSearch, CardTab } from "@/features/cards/card-search";
import { CardSettingsTab } from "@/features/cards/card-settings-tab";
import { currentAndUnpaid } from "@/features/cards/card-totals";
import { InstallmentPurchaseDialog } from "@/features/cards/installment-purchase-dialog";
import { PlansTab } from "@/features/cards/plans-tab";
import { PlasticCardsTab } from "@/features/cards/plastic-cards-tab";
import { addMonths, currentMonth } from "@/features/cards/reference-months";
import { StatementsChart } from "@/features/cards/statements-chart";
import { StatementsTab } from "@/features/cards/statements-tab";
import { useCommitments } from "@/features/cards/use-commitments";
import { institutionsQuery } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { Presence } from "@/ui/presence";

type Account = components["schemas"]["Account"];

export function CardRecord({
  account,
  search,
  scale,
}: {
  account: Account;
  search: CardSearch;
  scale: (code: string) => number;
}) {
  const t = useT();
  const api = useApi();
  const today = useToday();
  const navigate = useNavigate();
  const from = search.from ?? addMonths(currentMonth(today), -12);
  const statements = useQuery(statementsQuery(api, account.id, from));
  const rules = useQuery(billingRulesQuery(api, account.id));
  const plastics = useQuery(cardsQuery(api, account.id));
  const institutions = useQuery(institutionsQuery(api));
  const { current, unpaid } = currentAndUnpaid(statements.data ?? []);
  const after = current?.reference ?? currentMonth(today);
  const commitments = useCommitments(account.id, after);
  const committed = commitments.pending
    ? undefined
    : {
        amount: commitments.months.reduce(
          (sum, m) => sum + (m.amount?.amount ?? 0),
          0,
        ),
        currency: account.currency,
      };
  const [dialog, setDialog] = useState<
    "installments" | "close" | "reopen" | null
  >(null);
  const tab: CardTab = search.tab ?? "statements";
  const [chosen, setChosen] = useState<CardTab | null>(null);
  const shown = useDeferredValue(chosen ?? tab);
  const noRule = rules.data?.length === 0;

  const go = (next: { tab?: CardTab; rule?: true; from?: string }) => {
    const merged: CardSearch = { ...search };
    if (next.tab !== undefined) {
      delete merged.tab;
      delete merged.rule;
      if (next.tab !== "statements") merged.tab = next.tab;
    }
    if (next.rule === true) merged.rule = true;
    if (next.from !== undefined) merged.from = next.from;
    void navigate({
      to: "/cards/$accountId",
      params: { accountId: account.id },
      search: merged,
      replace: true,
    }).then(() => {
      setChosen(null);
    });
  };

  return (
    <Page width="full">
      <CardHeader
        account={account}
        institution={
          institutions.data?.find((i) => i.id === account.institution_id)?.name
        }
        lastFours={(plastics.data ?? [])
          .filter((c) => c.active)
          .map((c) => c.last_four)}
        current={current}
        unpaid={unpaid[0]}
        tab={chosen ?? tab}
        onTab={(next) => {
          setChosen(next);
          go({ tab: next });
        }}
        onInstallments={() => {
          setDialog("installments");
        }}
        onClose={() => {
          setDialog("close");
        }}
        onReopen={() => {
          setDialog("reopen");
        }}
      />
      <PageBody>
        <Stack gap={6}>
          <AccountSetupMessage accountId={account.id} />
          {noRule && (
            <Alert tone="warning">
              <AlertContent>
                <AlertDescription>{t("card.ruleMissing")}</AlertDescription>
              </AlertContent>
              <AlertActions>
                <Button
                  size="sm"
                  onClick={() => {
                    setChosen("settings");
                    go({ tab: "settings", rule: true });
                  }}
                >
                  {t("card.setRule")}
                </Button>
              </AlertActions>
            </Alert>
          )}
          <CardFigures
            account={account}
            current={current}
            unpaid={unpaid}
            committed={committed}
            loading={statements.isPending}
            scale={scale}
          />
          <StatementsChart
            statements={statements.data ?? []}
            commitments={commitments.months}
            currency={account.currency}
            scale={scale(account.currency)}
            loading={statements.isPending}
          />
          <div aria-busy={shown !== (chosen ?? tab) || undefined}>
            {shown === "statements" && (
              <StatementsTab
                accountId={account.id}
                statements={statements.data ?? []}
                loading={statements.isPending}
                onEarlier={() => {
                  go({ from: addMonths(from, -12) });
                }}
                scale={scale}
              />
            )}
            {shown === "plans" && (
              <PlansTab
                accountId={account.id}
                statements={statements.data ?? []}
                openReference={current?.reference}
                scale={scale}
              />
            )}
            {shown === "cards" && <PlasticCardsTab accountId={account.id} />}
            {shown === "settings" && (
              <CardSettingsTab
                account={account}
                ruleOpen={search.rule === true}
                onRuleOpen={(open) => {
                  void navigate({
                    to: "/cards/$accountId",
                    params: { accountId: account.id },
                    search: (() => {
                      const merged: CardSearch = { ...search };
                      delete merged.rule;
                      return open ? { ...merged, rule: true as const } : merged;
                    })(),
                    replace: true,
                  });
                }}
                scale={scale}
              />
            )}
          </div>
        </Stack>
      </PageBody>
      <Presence value={dialog === "installments" ? dialog : undefined}>
        {() => (
          <InstallmentPurchaseDialog
            account={account}
            scale={scale(account.currency)}
            onCancel={() => {
              setDialog(null);
            }}
            onDone={() => {
              setDialog(null);
              toast.show({ tone: "success", title: t("installments.done") });
            }}
          />
        )}
      </Presence>
      <Presence value={dialog === "close" ? dialog : undefined}>
        {() => (
          <CloseAccountDialog
            account={account}
            descendants={[]}
            scale={scale}
            onCancel={() => {
              setDialog(null);
            }}
            onDone={() => {
              setDialog(null);
              toast.show({
                tone: "success",
                title: t("account.closed", { name: account.name }),
              });
            }}
          />
        )}
      </Presence>
      <Presence value={dialog === "reopen" ? dialog : undefined}>
        {() => (
          <ReopenAccountDialog
            account={account}
            ancestors={[]}
            onCancel={() => {
              setDialog(null);
            }}
            onDone={() => {
              setDialog(null);
              toast.show({
                tone: "success",
                title: t("account.reopened", { name: account.name }),
              });
            }}
          />
        )}
      </Presence>
    </Page>
  );
}
