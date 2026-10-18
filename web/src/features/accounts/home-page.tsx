import { ButtonLink } from "@slotted/react/button";
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
  Section,
  SectionActions,
  SectionBody,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";

import { AccountGroups } from "@/features/accounts/account-groups";
import { Balances } from "@/features/accounts/balances";
import styles from "@/features/accounts/home-page.module.css";
import { UncategorizedShortcut } from "@/features/accounts/uncategorized-shortcut";
import { useBalanceGroups } from "@/features/accounts/use-balance-groups";
import { TransactionList } from "@/features/transactions";
import { useT } from "@/i18n/i18n-provider";
import { useSpaLink } from "@/ui/use-spa-link";
import { useViewport } from "@/ui/use-viewport";

const recentLimit = 5;

export function HomePage() {
  const t = useT();
  const viewport = useViewport();
  const spaLink = useSpaLink();
  const { groups, failed } = useBalanceGroups();
  const pending = groups === undefined && failed === null;
  return (
    <Page width="wide">
      <PageHeader>
        <PageHeaderTitleArea>
          <PageHeaderTitleRow>
            <PageHeaderTitle>
              <PageHeaderHeading>{t("nav.home")}</PageHeaderHeading>
            </PageHeaderTitle>
            {/* Ledger sheet L5: from 600 px the top bar holds New. */}
            {viewport === "phone" && (
              <PageHeaderActions>
                <ButtonLink
                  {...spaLink("/transactions/new")}
                  tone="secondary"
                  size="sm"
                >
                  {t("nav.entry")}
                </ButtonLink>
              </PageHeaderActions>
            )}
          </PageHeaderTitleRow>
        </PageHeaderTitleArea>
      </PageHeader>
      <PageBody>
        <div className={styles.layout}>
          {/* On a phone the bottom bar already holds Transactions and Accounts, so the sections carry no door to them. */}
          <Section aria-busy={pending} className={styles.full}>
            <SectionHeader>
              <SectionTitle>
                <SectionHeading>{t("home.balances")}</SectionHeading>
              </SectionTitle>
            </SectionHeader>
            <SectionBody>
              <Balances />
            </SectionBody>
          </Section>
          <UncategorizedShortcut className={styles.full} />
          <Section className={groups?.length === 0 ? styles.full : undefined}>
            <SectionHeader>
              <SectionTitle>
                <SectionHeading>{t("home.recent")}</SectionHeading>
              </SectionTitle>
              {viewport !== "phone" && (
                <SectionActions>
                  <ButtonLink
                    {...spaLink("/transactions")}
                    tone="secondary"
                    variant="ghost"
                    size="sm"
                  >
                    {t("home.recent.all")}
                  </ButtonLink>
                </SectionActions>
              )}
            </SectionHeader>
            <SectionBody>
              <TransactionList
                search={{}}
                limit={recentLimit}
                infinite={false}
              />
            </SectionBody>
          </Section>
          {/* With no account, the figures region states it once and leads to Accounts. */}
          {groups?.length !== 0 && (
            <Section aria-busy={pending}>
              <SectionHeader>
                <SectionTitle>
                  <SectionHeading>{t("home.accounts")}</SectionHeading>
                </SectionTitle>
                {viewport !== "phone" && (
                  <SectionActions>
                    <ButtonLink
                      {...spaLink("/accounts")}
                      tone="secondary"
                      variant="ghost"
                      size="sm"
                    >
                      {t("home.accounts.all")}
                    </ButtonLink>
                  </SectionActions>
                )}
              </SectionHeader>
              <SectionBody>
                <AccountGroups />
              </SectionBody>
            </Section>
          )}
        </div>
      </PageBody>
    </Page>
  );
}
