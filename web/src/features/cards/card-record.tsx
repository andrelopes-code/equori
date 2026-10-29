import {
  Alert,
  AlertActions,
  AlertContent,
  AlertDescription,
} from "@slotted/react/alert";
import { Button } from "@slotted/react/button";
import { Page, PageBody } from "@slotted/react/page";
import { Stack } from "@slotted/react/stack";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { AccountSetupMessage } from "@/features/accounts";
import {
  billingRulesQuery,
  cardsQuery,
  statementsQuery,
} from "@/features/cards/api";
import { CardAnalysis } from "@/features/cards/card-analysis";
import { CardDialogs } from "@/features/cards/card-dialogs";
import type { CardDialog } from "@/features/cards/card-dialogs";
import { CardFigures } from "@/features/cards/card-figures";
import { CardHeader } from "@/features/cards/card-header";
import type { CardSearch } from "@/features/cards/card-search";
import { CardTabPanel } from "@/features/cards/card-tab-panel";
import { currentAndUnpaid } from "@/features/cards/card-totals";
import { committedTotal } from "@/features/cards/committed-total";
import { addMonths, currentMonth } from "@/features/cards/reference-months";
import { StatementsChart } from "@/features/cards/statements-chart";
import { useCardTabs } from "@/features/cards/use-card-tabs";
import { useCommitments } from "@/features/cards/use-commitments";
import { institutionsQuery } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { compactQuery, useMediaQuery } from "@/ui/use-media-query";

type Account = components["schemas"]["Account"];

interface CardRecordProps {
  account: Account;
  search: CardSearch;
  scale: (code: string) => number;
}

export function CardRecord({ account, search, scale }: CardRecordProps) {
  const t = useT();
  const api = useApi();
  const today = useToday();
  const from = search.from ?? addMonths(currentMonth(today), -12);
  const statements = useQuery(statementsQuery(api, account.id, from));
  const rules = useQuery(billingRulesQuery(api, account.id));
  const plastics = useQuery(cardsQuery(api, account.id));
  const institutions = useQuery(institutionsQuery(api));
  const { current, unpaid } = currentAndUnpaid(statements.data ?? []);
  const after = current?.reference ?? currentMonth(today);
  const commitments = useCommitments(account.id, after);
  const cardTabs = useCardTabs(account.id, search);
  const compact = useMediaQuery(compactQuery);

  const [dialog, setDialog] = useState<CardDialog | null>(null);

  const committed = commitments.pending
    ? undefined
    : committedTotal(commitments.months, account.currency);
  const noRule = rules.data?.length === 0;
  // A phone reads the records under the tabs first, and the figures after them (mobile.md M2, M4).
  // The figures belong to the statements tab: under another tab they would push its content below the fold.
  const overview = cardTabs.shown === "statements" && (
    <>
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
      <CardAnalysis accountId={account.id} scale={scale(account.currency)} />
    </>
  );

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
        tab={cardTabs.marked}
        onTab={cardTabs.select}
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

              {/* The billing cycle is set in the settings tab, desktop-only (ADR 027, S5). */}
              {!compact && (
                <AlertActions>
                  <Button
                    onClick={() => {
                      cardTabs.select("settings", true);
                    }}
                  >
                    {t("card.setRule")}
                  </Button>
                </AlertActions>
              )}
            </Alert>
          )}
          {!compact && overview}
          <div aria-busy={cardTabs.refreshing || undefined}>
            <CardTabPanel
              tab={cardTabs.shown}
              account={account}
              search={search}
              statements={statements.data ?? []}
              loading={statements.isPending}
              openReference={current?.reference}
              onEarlier={() => {
                cardTabs.earlier(addMonths(from, -12));
              }}
              scale={scale}
            />
          </div>
          {compact && overview}
        </Stack>
      </PageBody>

      <CardDialogs
        dialog={dialog}
        account={account}
        scale={scale}
        onDismiss={() => {
          setDialog(null);
        }}
      />
    </Page>
  );
}
