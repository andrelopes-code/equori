import { useQuery } from "@tanstack/react-query";
import { List } from "@slotted/react/list";
import {
  ListItem,
  ListItemBody,
  ListItemEnd,
  ListItemLabel,
  ListItemLink,
} from "@slotted/react/list-item";
import {
  ResultState,
  ResultStateContent,
  ResultStateTitle,
} from "@slotted/react/result-state";
import {
  StatCard,
  StatCardComparison,
  StatCardFigure,
  StatCardHeader,
  StatCardLabel,
  StatCardValue,
} from "@slotted/react/stat-card";

import { useApi } from "@/api/api-context";
import { accountsQuery, balancesQuery } from "@/features/accounts/api";
import { groupBalances } from "@/features/accounts/balance-groups";
import type { Group } from "@/features/accounts/balance-groups";
import { BalancesPlaceholder } from "@/features/accounts/balances-placeholder";
import styles from "@/features/accounts/home-page.module.css";
import { instrumentsQuery, settingsQuery, useScale } from "@/features/setup";
import type { MessageKey } from "@/i18n/catalog.en";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { MoneyText } from "@/ui/money-text";
import { QueryError } from "@/ui/query-error";
import { useSpaLink } from "@/ui/use-spa-link";

const groupLabels: Record<Group, MessageKey> = {
  available: "home.group.available",
  reserves: "home.group.reserves",
  cards: "home.group.cards",
  loans: "home.group.loans",
};

export function Balances() {
  const t = useT();
  const api = useApi();
  const today = useToday();
  const scale = useScale();
  const spaLink = useSpaLink();
  const accounts = useQuery(accountsQuery(api));
  const balances = useQuery(balancesQuery(api, today, "booked"));
  const settings = useQuery(settingsQuery(api));
  const instruments = useQuery(instrumentsQuery(api));
  const queries = [accounts, balances, settings, instruments];

  const failed = queries.find((q) => q.isError);
  if (failed?.error) {
    return (
      <QueryError
        error={failed.error}
        onRetry={() => {
          for (const query of queries) {
            if (query.isError) void query.refetch();
          }
        }}
      />
    );
  }
  if (
    accounts.data === undefined ||
    balances.data === undefined ||
    settings.data === undefined ||
    scale === null
  ) {
    return <BalancesPlaceholder />;
  }
  const groups = groupBalances(
    accounts.data,
    balances.data,
    settings.data.base_currency,
  );
  if (groups.length === 0) {
    return (
      <ResultState status="empty" reach="section">
        <ResultStateContent>
          <ResultStateTitle>{t("home.empty")}</ResultStateTitle>
        </ResultStateContent>
      </ResultState>
    );
  }
  return (
    <div className={styles.groups}>
      {groups.map(({ group, items, total, excluded }) => (
        <div key={group} className={styles.group}>
          <StatCard>
            <StatCardHeader>
              <StatCardLabel>{t(groupLabels[group])}</StatCardLabel>
            </StatCardHeader>
            <StatCardFigure>
              <StatCardValue>
                <MoneyText
                  money={total}
                  scale={scale(total.currency)}
                  tone="balance"
                />
              </StatCardValue>
              {excluded > 0 && (
                <StatCardComparison>
                  {t("home.excluded", { count: excluded })}
                </StatCardComparison>
              )}
            </StatCardFigure>
          </StatCard>
          <List variant="ruled" aria-label={t(groupLabels[group])}>
            {items.map(({ account, balance }) => (
              <ListItem key={account.id}>
                <ListItemLink {...spaLink(`/accounts/${account.id}`)}>
                  <ListItemBody>
                    <ListItemLabel>{account.name}</ListItemLabel>
                  </ListItemBody>
                  <ListItemEnd>
                    <MoneyText
                      money={balance}
                      scale={scale(balance.currency)}
                      tone="balance"
                    />
                  </ListItemEnd>
                </ListItemLink>
              </ListItem>
            ))}
          </List>
        </div>
      ))}
    </div>
  );
}
