import { Page, PageBody } from "@slotted/react/page";
import {
  PageHeader,
  PageHeaderActions,
  PageHeaderHeading,
  PageHeaderSubheading,
  PageHeaderTitle,
  PageHeaderTitleArea,
  PageHeaderTitleRow,
} from "@slotted/react/page-header";
import {
  ResultState,
  ResultStateContent,
  ResultStateDescription,
  ResultStateTitle,
} from "@slotted/react/result-state";
import { Stack } from "@slotted/react/stack";
import { Switch } from "@slotted/react/switch";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useDeferredValue, useState } from "react";

import { HeaderProgress } from "@/ui/header-progress";
import { RefreshButton } from "@/ui/refresh-button";
import { useRefresh } from "@/ui/use-refresh";
import { useApi } from "@/api/api-context";
import { accountsQuery } from "@/features/accounts";
import { cardTotals } from "@/features/cards/card-totals";
import { CardTile } from "@/features/cards/card-tile";
import { CardsFigures } from "@/features/cards/cards-figures";
import styles from "@/features/cards/card-tile.module.css";
import { useCardStatements } from "@/features/cards/use-card-statements";
import { institutionsQuery, settingsQuery, useScale } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";
import { HeaderAction } from "@/ui/header-action";
import { QueryError } from "@/ui/query-error";
import { useServed } from "@/ui/use-served";

// The credit cards: what each one bills now, what is due and when, and how much limit is free.
const newCard = {
  to: "/accounts/new",
  search: { kind: "credit_card" },
} as const;

export function CardsPage() {
  const t = useT();
  const api = useApi();
  const navigate = useNavigate();
  const served = useServed();
  const queryClient = useQueryClient();
  const scale = useScale();
  const accounts = useQuery(accountsQuery(api));
  const institutions = useQuery(institutionsQuery(api));
  const settings = useQuery(settingsQuery(api));
  const [showClosed, setShowClosed] = useState(false);
  const closedShown = useDeferredValue(showClosed);
  const cards = (accounts.data ?? []).filter(
    (a) =>
      a.kind === "credit_card" && (closedShown || a.closed_on === undefined),
  );
  const states = useCardStatements(cards);
  const base = settings.data?.base_currency;
  const totals =
    base === undefined
      ? undefined
      : cardTotals(
          states.filter((s) => s.account.closed_on === undefined),
          base,
        );
  const sc = scale ?? (() => 2);
  const loading =
    accounts.isPending || states.some((s) => s.loading) || scale === null;
  const openCount = (accounts.data ?? []).filter(
    (a) => a.kind === "credit_card" && a.closed_on === undefined,
  ).length;

  const refresh = useRefresh(() =>
    queryClient.invalidateQueries({ queryKey: ["accounts"] }),
  );
  return (
    <Page width="full">
      <PageHeader size="lg">
        <PageHeaderTitleArea>
          <PageHeaderTitleRow>
            <PageHeaderTitle>
              <PageHeaderHeading>{t("nav.cards")}</PageHeaderHeading>
              <PageHeaderSubheading>
                {t(openCount === 1 ? "cards.subtitleOne" : "cards.subtitle", {
                  count: openCount,
                })}
              </PageHeaderSubheading>
            </PageHeaderTitle>
            <PageHeaderActions>
              <RefreshButton
                label={t("cards.refresh")}
                refreshing={refresh.refreshing}
                onRefresh={refresh.refresh}
              />
              {served(newCard) && (
                <HeaderAction
                  primary
                  label={t("cards.new")}
                  glyph="plus"
                  onClick={() => {
                    void navigate(newCard);
                  }}
                />
              )}
            </PageHeaderActions>
          </PageHeaderTitleRow>
        </PageHeaderTitleArea>
        <HeaderProgress
          loading={
            refresh.refreshing || (accounts.isFetching && !accounts.isPending)
          }
          {...(refresh.refreshing ? { delay: 0 } : {})}
        />
      </PageHeader>
      <PageBody>
        {accounts.isError ? (
          <QueryError
            error={accounts.error}
            onRetry={() => void accounts.refetch()}
          />
        ) : !accounts.isPending && openCount === 0 && !showClosed ? (
          <ResultState status="empty" reach="section">
            <ResultStateContent>
              <ResultStateTitle>{t("cards.empty")}</ResultStateTitle>
              <ResultStateDescription>
                {t("cards.emptyHint")}
              </ResultStateDescription>
            </ResultStateContent>
          </ResultState>
        ) : (
          <Stack gap={6}>
            <CardsFigures totals={totals} loading={loading} />
            <Switch checked={showClosed} onCheckedChange={setShowClosed}>
              {t("cards.showClosed")}
            </Switch>
            <div
              className={styles.grid}
              aria-busy={closedShown !== showClosed || undefined}
            >
              {states.map((state) => (
                <CardTile
                  key={state.account.id}
                  account={state.account}
                  institution={institutions.data?.find(
                    (i) => i.id === state.account.institution_id,
                  )}
                  current={state.current}
                  unpaid={state.unpaid}
                  loading={state.loading}
                  scale={sc}
                />
              ))}
            </div>
          </Stack>
        )}
      </PageBody>
    </Page>
  );
}
