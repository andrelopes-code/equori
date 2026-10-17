import { useQuery } from "@tanstack/react-query";
import { ButtonLink } from "@slotted/react/button";
import { List } from "@slotted/react/list";
import {
  ListItem,
  ListItemBody,
  ListItemEnd,
  ListItemLabel,
  ListItemLink,
} from "@slotted/react/list-item";
import { Page, PageBody } from "@slotted/react/page";
import {
  PageHeader,
  PageHeaderActions,
  PageHeaderHeading,
  PageHeaderTitle,
  PageHeaderTitleArea,
  PageHeaderTitleRow,
} from "@slotted/react/page-header";
import {
  ResultState,
  ResultStateContent,
  ResultStateTitle,
} from "@slotted/react/result-state";
import {
  Section,
  SectionBody,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";
import { Skeleton, SkeletonRegion } from "@slotted/react/skeleton";
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
import styles from "@/features/accounts/home-page.module.css";
import { instrumentsQuery, settingsQuery, useScale } from "@/features/setup";
import {
  TransactionList,
  uncategorizedCountQuery,
} from "@/features/transactions";
import type { MessageKey } from "@/i18n/catalog.en";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { MoneyText } from "@/ui/money-text";
import { QueryError } from "@/ui/query-error";
import { useSpaLink } from "@/ui/use-spa-link";
import { useViewport } from "@/ui/use-viewport";

const groupLabels: Record<Group, MessageKey> = {
  available: "home.group.available",
  reserves: "home.group.reserves",
  cards: "home.group.cards",
  loans: "home.group.loans",
};

const recentLimit = 5;
const uncategorizedHref = "/transactions?uncategorized=true";

function BalancesPlaceholder() {
  return (
    <SkeletonRegion>
      <div className={styles.groups}>
        {[0, 1].map((n) => (
          <div key={n} className={styles.group}>
            <StatCard loading>
              <StatCardHeader>
                <StatCardLabel />
              </StatCardHeader>
              <StatCardFigure>
                <StatCardValue />
              </StatCardFigure>
            </StatCard>
            <List aria-hidden="true">
              {[0, 1].map((row) => (
                <ListItem key={row}>
                  <ListItemBody>
                    <Skeleton shape="text" inlineSize="50%" />
                  </ListItemBody>
                </ListItem>
              ))}
            </List>
          </div>
        ))}
      </div>
    </SkeletonRegion>
  );
}

function Balances() {
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

function UncategorizedShortcut() {
  const t = useT();
  const spaLink = useSpaLink();
  const { data } = useQuery(uncategorizedCountQuery(useApi()));
  if (data === undefined || data.count === 0) return null;
  const count = data.more ? `${String(data.count)}+` : String(data.count);
  return (
    <div>
      <ButtonLink
        {...spaLink(uncategorizedHref)}
        tone="secondary"
        variant="outline"
      >
        {t("home.uncategorized", { count })}
      </ButtonLink>
    </div>
  );
}

export function HomePage() {
  const t = useT();
  const viewport = useViewport();
  const spaLink = useSpaLink();
  const api = useApi();
  const today = useToday();
  const pending = [
    useQuery(accountsQuery(api)),
    useQuery(balancesQuery(api, today, "booked")),
    useQuery(settingsQuery(api)),
    useQuery(instrumentsQuery(api)),
  ].some((q) => q.data === undefined && !q.isError);
  return (
    <Page width="wide">
      <PageHeader>
        <PageHeaderTitleArea>
          <PageHeaderTitleRow>
            <PageHeaderTitle>
              <PageHeaderHeading>{t("nav.home")}</PageHeaderHeading>
            </PageHeaderTitle>
            {viewport !== "phone" && (
              <PageHeaderActions>
                <ButtonLink {...spaLink("/transactions/new")}>
                  {t("nav.new")}
                </ButtonLink>
              </PageHeaderActions>
            )}
          </PageHeaderTitleRow>
        </PageHeaderTitleArea>
      </PageHeader>
      <PageBody>
        <div className={styles.stack}>
          <UncategorizedShortcut />
          <Section aria-busy={pending}>
            <SectionHeader>
              <SectionTitle>
                <SectionHeading>{t("home.balances")}</SectionHeading>
              </SectionTitle>
            </SectionHeader>
            <SectionBody>
              <Balances />
            </SectionBody>
          </Section>
          <Section>
            <SectionHeader>
              <SectionTitle>
                <SectionHeading>{t("home.recent")}</SectionHeading>
              </SectionTitle>
            </SectionHeader>
            <SectionBody>
              <TransactionList
                search={{}}
                limit={recentLimit}
                infinite={false}
              />
            </SectionBody>
          </Section>
        </div>
      </PageBody>
    </Page>
  );
}
